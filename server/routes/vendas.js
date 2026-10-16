const router = require('express').Router();
const { z } = require('zod');
const { pool, query, tx } = require('../db');
const { HttpError, wrap, parse, arred, arred3 } = require('../util');
const { soCaixa } = require('../auth');
const { caixaAberto, movimentoCaixa } = require('../cash');

const TZ = process.env.TZ_EMPRESA || 'America/Sao_Paulo';
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const uuid = z.string().uuid().transform((s) => s.toLowerCase());

const novaVenda = z.object({
  chave: uuid.nullish(),
  clienteId: uuid.nullish(),
  itens: z.array(z.object({
    produtoId: uuid,
    quantidade: z.coerce.number().min(0.001).max(999999).transform(arred3),
  })).min(1).max(200),
  desconto: z.coerce.number().min(0).max(9999999).default(0).transform(arred),
  pagamentos: z.array(z.object({
    forma: z.enum(['dinheiro', 'pix', 'debito', 'credito']),
    valor: z.coerce.number().min(0.01).max(9999999).transform(arred),
  })).max(10).default([]),
  fiado: z.boolean().default(false),
  observacao: z.string().trim().max(300).nullish().transform((v) => v || null),
});
const devolucao = z.object({
  motivo: z.string().trim().min(3).max(300),
  itens: z.array(z.object({
    itemId: uuid,
    quantidade: z.coerce.number().min(0.001).max(999999).transform(arred3),
  })).min(1).max(200),
  formaReembolso: z.enum(['dinheiro', 'pix', 'debito', 'credito']).nullish(),
});

/* Venda completa (cabeçalho, itens, pagamentos e dados da empresa) para tela e comprovante */
async function carregar(db, empresaId, id) {
  const v = await db.query(
    `select v.id, v.numero, v.status, coalesce(v.finalizada_em, v.criado_em) as criado_em, v.cancelada_em,
            v.cliente_id, v.cliente_nome, v.usuario_nome, v.vendedor_nome,
            v.subtotal, v.desconto, v.total, v.troco, v.observacao,
            greatest(v.total - coalesce(pg.valor, 0) - coalesce(d.valor, 0), 0) as saldo_devedor,
            e.nome as e_nome, e.documento as e_documento, e.telefone as e_telefone, e.endereco as e_endereco
       from vendas v join empresas e on e.id = v.empresa_id
       left join lateral (select sum(valor) as valor from venda_pagamentos where venda_id = v.id) pg on true
       left join lateral (select sum(valor) as valor from venda_devolucoes where venda_id = v.id) d on true
      where v.id = $1 and v.empresa_id = $2`,
    [id, empresaId]
  );
  const r = v.rows[0];
  if (!r) return null;
  const itens = await db.query(
    'select id, item, codigo, descricao, unidade, quantidade, preco_unit, total from venda_itens where venda_id = $1 order by item',
    [id]
  );
  const pagamentos = await db.query(
    'select id, forma, valor from venda_pagamentos where venda_id = $1 order by ordem',
    [id]
  );
  const devolucoes = await db.query(
    `select id, motivo, valor, valor_reembolsado, forma_reembolso, criado_em
       from venda_devolucoes where venda_id = $1 order by criado_em`,
    [id]
  );
  const { e_nome, e_documento, e_telefone, e_endereco, ...venda } = r;
  return {
    ...venda,
    empresa: { nome: e_nome, documento: e_documento, telefone: e_telefone, endereco: e_endereco },
    itens: itens.rows,
    pagamentos: pagamentos.rows,
    devolucoes: devolucoes.rows,
  };
}

async function registrarDevolucao(c, { vendaId, empresaId, usuario, motivo, itensSolicitados, formaReembolso, cancelar }) {
  const vendaResult = await c.query(
    `select id, numero, status, total, troco from vendas
      where id = $1 and empresa_id = $2 for update`,
    [vendaId, empresaId]
  );
  const venda = vendaResult.rows[0];
  if (!venda) throw new HttpError(404, 'Venda não encontrada.');
  if (venda.status !== 'concluida') throw new HttpError(409, 'Só é possível devolver uma venda concluída.');

  const itemResult = await c.query(
    `select id, produto_id, codigo, descricao, quantidade, quantidade_devolvida,
            preco_unit, estoque_reservado
       from venda_itens where venda_id = $1 order by item for update`,
    [vendaId]
  );
  const porId = new Map(itemResult.rows.map((i) => [i.id, i]));
  const qtds = new Map();
  for (const item of itensSolicitados) {
    qtds.set(item.itemId, arred3((qtds.get(item.itemId) || 0) + item.quantidade));
  }
  let valor = 0;
  for (const [itemId, quantidade] of qtds) {
    const item = porId.get(itemId);
    if (!item) throw new HttpError(400, 'Item não pertence a esta venda.');
    if (quantidade > Number(item.quantidade) - Number(item.quantidade_devolvida)) {
      throw new HttpError(400, `Quantidade de devolução maior que a disponível para "${item.descricao}".`);
    }
    valor = arred(valor + arred(quantidade * Number(item.preco_unit)));
  }
  if (!(valor > 0)) throw new HttpError(400, 'Informe ao menos um item para devolver.');

  const pagamentos = await c.query(
    'select coalesce(sum(valor), 0) as recebido from venda_pagamentos where venda_id = $1',
    [vendaId]
  );
  const devolucoes = await c.query(
    'select coalesce(sum(valor), 0) as valor from venda_devolucoes where venda_id = $1',
    [vendaId]
  );
  const recebidoLiquido = Math.max(Number(pagamentos.rows[0].recebido) - Number(venda.troco), 0);
  const saldoAntes = Math.max(Number(venda.total) - recebidoLiquido - Number(devolucoes.rows[0].valor), 0);
  const valorReembolsado = arred(Math.max(valor - saldoAntes, 0));
  if (valorReembolsado > 0 && !formaReembolso) {
    throw new HttpError(400, 'Escolha a forma de reembolso para o valor já pago ao cliente.');
  }

  const caixaId = await caixaAberto(c, empresaId, usuario.id);
  const cabecalho = await c.query(
    `insert into venda_devolucoes (venda_id, empresa_id, usuario_id, caixa_id, motivo, valor, valor_reembolsado, forma_reembolso)
     values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
    [vendaId, empresaId, usuario.id, caixaId, motivo, valor, valorReembolsado, valorReembolsado ? formaReembolso : null]
  );
  for (const [itemId, quantidade] of qtds) {
    const item = porId.get(itemId);
    const itemValor = arred(quantidade * Number(item.preco_unit));
    await c.query(
      `insert into venda_devolucao_itens (devolucao_id, venda_item_id, quantidade, valor)
       values ($1, $2, $3, $4)`,
      [cabecalho.rows[0].id, itemId, quantidade, itemValor]
    );
    await c.query(
      'update venda_itens set quantidade_devolvida = quantidade_devolvida + $2 where id = $1',
      [itemId, quantidade]
    );
    if (item.estoque_reservado && item.produto_id) {
      const produto = await c.query(
        `update produtos set estoque = estoque + $2
          where id = $1 and empresa_id = $3
          returning estoque, descricao`,
        [item.produto_id, quantidade, empresaId]
      );
      if (produto.rows[0]) {
        await c.query(
          `insert into estoque_movimentos
            (empresa_id, produto_id, produto_descricao, usuario_id, venda_id, tipo, variacao, estoque_apos, motivo)
           values ($1, $2, $3, $4, $5, 'devolucao', $6, $7, $8)`,
          [empresaId, item.produto_id, produto.rows[0].descricao, usuario.id, vendaId,
            quantidade, produto.rows[0].estoque, motivo]
        );
      }
    }
  }

  if (valorReembolsado > 0 && formaReembolso === 'dinheiro') {
    await movimentoCaixa(c, {
      caixaId, empresaId, usuarioId: usuario.id, tipo: 'devolucao',
      valor: valorReembolsado, descricao: `Devolução da venda ${venda.numero}: ${motivo}`,
    });
  }

  const restantes = await c.query(
    'select count(*)::int as quantidade from venda_itens where venda_id = $1 and quantidade_devolvida < quantidade',
    [vendaId]
  );
  const cancelada = cancelar || restantes.rows[0].quantidade === 0;
  if (cancelada) {
    await c.query(
      `update vendas set status = 'cancelada', cancelada_em = now(), motivo_cancelamento = $2 where id = $1`,
      [vendaId, motivo]
    );
  }
}

router.get('/', wrap(async (req, res) => {
  const de = DATA.test(req.query.de) ? req.query.de : null;
  const ate = DATA.test(req.query.ate) ? req.query.ate : null;
  const q = String(req.query.q || '').trim().slice(0, 60);
  const like = q.replace(/[\\%_]/g, '\\$&');
  const { rows } = await query(
    `select v.id, v.numero, coalesce(v.finalizada_em, v.criado_em) as criado_em,
            v.cliente_nome, v.usuario_nome, v.vendedor_nome, v.total, v.status,
            greatest(v.total - coalesce(pg.valor, 0) - coalesce(d.valor, 0), 0) as saldo_devedor
       from vendas v
       left join lateral (select sum(valor) as valor from venda_pagamentos where venda_id = v.id) pg on true
       left join lateral (select sum(valor) as valor from venda_devolucoes where venda_id = v.id) d on true
      where v.empresa_id = $1 and v.status <> 'pendente' and v.finalizada_em is not null
        and ($2::date is null or coalesce(v.finalizada_em, v.criado_em) >= (($2::date)::timestamp at time zone $4))
        and ($3::date is null or coalesce(v.finalizada_em, v.criado_em) < ((($3::date) + 1)::timestamp at time zone $4))
        and ($5 = '' or v.numero::text = $5 or v.cliente_nome ilike '%' || $6 || '%')
      order by v.numero desc
      limit 300`,
    [req.user.empresa_id, de, ate, TZ, q, like]
  );
  res.json(rows);
}));

router.get('/:id', wrap(async (req, res) => {
  const v = await carregar(pool, req.user.empresa_id, req.params.id);
  if (!v) throw new HttpError(404, 'Venda não encontrada.');
  res.json(v);
}));

router.post('/', soCaixa, wrap(async (req, res) => {
  const d = parse(novaVenda, req.body);
  const emp = req.user.empresa_id;

  /* Se o navegador repetir o envio (queda de rede, clique duplo), devolve a venda já gravada */
  if (d.chave) {
    const ja = await query('select id from vendas where empresa_id = $1 and chave = $2', [emp, d.chave]);
    if (ja.rows[0]) return res.json(await carregar(pool, emp, ja.rows[0].id));
  }

  const venda = await tx(async (c) => {
    /* Preço e estoque vêm sempre do banco, nunca do navegador. A baixa é condicional
       (sem estoque, não atualiza) e os produtos são travados em ordem fixa para não gerar deadlock. */
    const qtds = new Map();
    for (const i of d.itens) qtds.set(i.produtoId, arred3((qtds.get(i.produtoId) || 0) + i.quantidade));
    const prods = new Map();
    for (const id of [...qtds.keys()].sort()) {
      const r = await c.query(
        `update produtos
            set estoque = case when controla_estoque then estoque - $3 else estoque end
          where id = $1 and empresa_id = $2 and ativo and (not controla_estoque or estoque >= $3)
          returning id, codigo, descricao, unidade, preco, controla_estoque`,
        [id, emp, qtds.get(id)]
      );
      if (!r.rows[0]) {
        const p = await c.query('select descricao, estoque, ativo from produtos where id = $1 and empresa_id = $2', [id, emp]);
        if (!p.rows[0] || !p.rows[0].ativo) throw new HttpError(400, 'Há um produto inexistente ou inativo no carrinho.');
        throw new HttpError(409, `Estoque insuficiente de "${p.rows[0].descricao}" (disponível: ${p.rows[0].estoque}).`);
      }
      prods.set(id, r.rows[0]);
    }

    const linhas = d.itens.map((i) => {
      const p = prods.get(i.produtoId);
      return { produtoId: p.id, codigo: p.codigo, descricao: p.descricao, unidade: p.unidade, quantidade: i.quantidade, preco: p.preco, total: arred(i.quantidade * p.preco) };
    });
    const subtotal = arred(linhas.reduce((s, l) => s + l.total, 0));
    if (d.desconto > subtotal) throw new HttpError(400, 'O desconto não pode ser maior que o subtotal.');
    const total = arred(subtotal - d.desconto);
    const pago = arred(d.pagamentos.reduce((s, p) => s + p.valor, 0));
    if (pago < total && !d.fiado) throw new HttpError(400, `Pagamento insuficiente: faltam R$ ${(total - pago).toFixed(2)}. Marque "fiado" para deixar o saldo em aberto.`);
    const troco = arred(Math.max(pago - total, 0));
    const emDinheiro = arred(d.pagamentos.filter((p) => p.forma === 'dinheiro').reduce((s, p) => s + p.valor, 0));
    if (troco > emDinheiro) throw new HttpError(400, 'O troco só pode sair de pagamento em dinheiro.');
    const caixaId = await caixaAberto(c, emp, req.user.id);

    let cliente = null;
    if (d.clienteId) {
      const r = await c.query('select id, nome from clientes where id = $1 and empresa_id = $2 and ativo', [d.clienteId, emp]);
      if (!r.rows[0]) throw new HttpError(400, 'Cliente não encontrado.');
      cliente = r.rows[0];
    }

    /* O UPDATE trava a linha da empresa: duas vendas simultâneas nunca recebem o mesmo número */
    const n = await c.query(
      'update empresas set proximo_numero = proximo_numero + 1 where id = $1 returning proximo_numero - 1 as numero',
      [emp]
    );
    const v = await c.query(
      `insert into vendas (empresa_id, numero, chave, cliente_id, cliente_nome, usuario_id, usuario_nome,
                           subtotal, desconto, total, troco, observacao, finalizada_em)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now()) returning id`,
      [emp, n.rows[0].numero, d.chave ?? null, cliente?.id ?? null, cliente?.nome ?? null, req.user.id, req.user.nome,
        subtotal, d.desconto, total, troco, d.observacao]
    );
    const vid = v.rows[0].id;

    let seq = 0;
    for (const l of linhas) {
      seq += 1;
      await c.query(
        `insert into venda_itens (venda_id, empresa_id, item, produto_id, codigo, descricao, unidade, quantidade, preco_unit, total, estoque_reservado)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [vid, emp, seq, l.produtoId, l.codigo, l.descricao, l.unidade, l.quantidade, l.preco, l.total, prods.get(l.produtoId).controla_estoque]
      );
    }
    let ordem = 0;
    for (const p of d.pagamentos) {
      ordem += 1;
      await c.query(
        'insert into venda_pagamentos (venda_id, empresa_id, ordem, forma, valor, caixa_id) values ($1, $2, $3, $4, $5, $6)',
        [vid, emp, ordem, p.forma, p.valor, caixaId]
      );
    }
    const dinheiroRecebido = arred(emDinheiro - troco);
    await movimentoCaixa(c, {
      caixaId, empresaId: emp, usuarioId: req.user.id, tipo: 'venda',
      valor: dinheiroRecebido, descricao: `Venda ${n.rows[0].numero}`,
    });
    return carregar(c, emp, vid);
  });

  res.status(201).json(venda);
}));

/* Cancela a venda e devolve os itens ao estoque (só administrador) */
router.post('/:id/cancelar', soAdmin, wrap(async (req, res) => {
  const emp = req.user.empresa_id;
  const venda = await tx(async (c) => {
    const s = await c.query('select id, status from vendas where id = $1 and empresa_id = $2 for update', [req.params.id, emp]);
    if (!s.rows[0]) throw new HttpError(404, 'Venda não encontrada.');
    if (s.rows[0].status !== 'concluida') throw new HttpError(409, 'Esta venda já está cancelada.');
    const id = s.rows[0].id;
    await c.query(
      `update produtos p set estoque = p.estoque + i.quantidade
         from venda_itens i
        where i.venda_id = $1 and i.produto_id = p.id and p.empresa_id = $2 and i.estoque_reservado`,
      [id, emp]
    );
    const d = parse(z.object({ motivo: z.string().trim().min(3).max(300) }), req.body);
    await c.query("update vendas set status = 'cancelada', cancelada_em = now(), motivo_cancelamento = $2 where id = $1", [id, d.motivo]);
    return carregar(c, emp, id);
  });
  res.json(venda);
}));

module.exports = router;
