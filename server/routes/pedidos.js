const router = require('express').Router();
const { z } = require('zod');
const { pool, query, tx } = require('../db');
const { HttpError, wrap, parse, arred, arred3 } = require('../util');
const { soCaixa, soVendedor } = require('../auth');
const { caixaAberto, movimentoCaixa } = require('../cash');

const uuid = z.string().uuid().transform((s) => s.toLowerCase());
const novoPedido = z.object({
  chave: uuid.nullish(),
  clienteId: uuid,
  itens: z.array(z.object({
    produtoId: uuid,
    quantidade: z.coerce.number().min(0.001).max(999999).transform(arred3),
  })).min(1).max(200),
  desconto: z.coerce.number().min(0).max(9999999).default(0).transform(arred),
});
const pagamentosPedido = z.object({
  pagamentos: z.array(z.object({
    forma: z.enum(['dinheiro', 'pix', 'debito', 'credito']),
    valor: z.coerce.number().min(0.01).max(9999999).transform(arred),
  })).max(10).default([]),
  fiado: z.boolean().default(false),
});

async function carregarPedido(db, empresaId, id) {
  const { rows } = await db.query(
    `select v.id, v.numero, v.status, v.criado_em, v.cliente_id, v.cliente_nome,
            v.vendedor_id, v.vendedor_nome, v.subtotal, v.desconto, v.total,
            coalesce((
              select json_agg(json_build_object(
                'id', i.id, 'produto_id', i.produto_id, 'codigo', i.codigo,
                'descricao', i.descricao, 'unidade', i.unidade,
                'quantidade', i.quantidade, 'preco_unit', i.preco_unit, 'total', i.total
              ) order by i.item)
              from venda_itens i where i.venda_id = v.id
            ), '[]'::json) as itens
       from vendas v
      where v.id = $1 and v.empresa_id = $2`,
    [id, empresaId]
  );
  return rows[0] || null;
}

router.get('/', wrap(async (req, res) => {
  const { rows } = await query(
    `select v.id, v.numero, v.criado_em, v.cliente_id, v.cliente_nome, v.vendedor_id, v.vendedor_nome,
            v.subtotal, v.desconto, v.total,
            coalesce((
              select json_agg(json_build_object(
                'id', i.id, 'produto_id', i.produto_id, 'codigo', i.codigo,
                'descricao', i.descricao, 'unidade', i.unidade,
                'quantidade', i.quantidade, 'preco_unit', i.preco_unit, 'total', i.total
              ) order by i.item)
              from venda_itens i where i.venda_id = v.id
            ), '[]'::json) as itens
       from vendas v
      where v.empresa_id = $1 and v.status = 'pendente'
      order by v.criado_em, v.numero
      limit 200`,
    [req.user.empresa_id]
  );
  res.json(rows);
}));

router.post('/', soVendedor, wrap(async (req, res) => {
  const d = parse(novoPedido, req.body);
  const emp = req.user.empresa_id;

  if (d.chave) {
    const ja = await query('select id from vendas where empresa_id = $1 and chave = $2', [emp, d.chave]);
    if (ja.rows[0]) return res.json(await carregarPedido(pool, emp, ja.rows[0].id));
  }

  const pedido = await tx(async (c) => {
    const qtds = new Map();
    for (const i of d.itens) qtds.set(i.produtoId, arred3((qtds.get(i.produtoId) || 0) + i.quantidade));
    const prods = new Map();
    for (const id of [...qtds.keys()].sort()) {
      const r = await c.query(
        `update produtos
            set estoque = case when controla_estoque then estoque - $3 else estoque end
          where id = $1 and empresa_id = $2 and ativo and (not controla_estoque or estoque >= $3)
          returning id, codigo, descricao, unidade, preco, controla_estoque, estoque`,
        [id, emp, qtds.get(id)]
      );
      if (!r.rows[0]) {
        const p = await c.query('select descricao, estoque, ativo from produtos where id = $1 and empresa_id = $2', [id, emp]);
        if (!p.rows[0] || !p.rows[0].ativo) throw new HttpError(400, 'Há um produto inexistente ou inativo no pedido.');
        throw new HttpError(409, `Estoque insuficiente de "${p.rows[0].descricao}" (disponível: ${p.rows[0].estoque}).`);
      }
      prods.set(id, r.rows[0]);
    }

    const linhas = d.itens.map((i) => {
      const p = prods.get(i.produtoId);
      return {
        produtoId: p.id, codigo: p.codigo, descricao: p.descricao, unidade: p.unidade,
        quantidade: i.quantidade, preco: p.preco, total: arred(i.quantidade * p.preco),
        estoqueReservado: p.controla_estoque,
      };
    });
    const subtotal = arred(linhas.reduce((s, l) => s + l.total, 0));
    if (d.desconto > subtotal) throw new HttpError(400, 'O desconto não pode ser maior que o subtotal.');
    const total = arred(subtotal - d.desconto);
    const cliente = await c.query(
      'select id, nome from clientes where id = $1 and empresa_id = $2 and ativo',
      [d.clienteId, emp]
    );
    if (!cliente.rows[0]) throw new HttpError(400, 'Cliente não encontrado.');

    const n = await c.query(
      'update empresas set proximo_numero = proximo_numero + 1 where id = $1 returning proximo_numero - 1 as numero',
      [emp]
    );
    const v = await c.query(
      `insert into vendas (empresa_id, numero, chave, cliente_id, cliente_nome, vendedor_id, vendedor_nome,
                           subtotal, desconto, total, status)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pendente') returning id`,
      [emp, n.rows[0].numero, d.chave ?? null, cliente.rows[0].id, cliente.rows[0].nome,
        req.user.id, req.user.nome, subtotal, d.desconto, total]
    );
    const pedidoId = v.rows[0].id;

    for (const [index, l] of linhas.entries()) {
      await c.query(
        `insert into venda_itens
          (venda_id, empresa_id, item, produto_id, codigo, descricao, unidade, quantidade, preco_unit, total, estoque_reservado)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [pedidoId, emp, index + 1, l.produtoId, l.codigo, l.descricao, l.unidade,
          l.quantidade, l.preco, l.total, l.estoqueReservado]
      );
    }
    for (const [produtoId, quantidade] of qtds) {
      const p = prods.get(produtoId);
      if (!p.controla_estoque) continue;
      await c.query(
        `insert into estoque_movimentos
          (empresa_id, produto_id, produto_descricao, usuario_id, venda_id, tipo, variacao, estoque_apos, motivo)
         values ($1, $2, $3, $4, $5, 'reserva_pedido', $6, $7, 'Pedido aguardando pagamento')`,
        [emp, produtoId, p.descricao, req.user.id, pedidoId, -quantidade, p.estoque]
      );
    }
    return carregarPedido(c, emp, pedidoId);
  });

  res.status(201).json(pedido);
}));

router.post('/:id/finalizar', soCaixa, wrap(async (req, res) => {
  const d = parse(pagamentosPedido, req.body);
  const emp = req.user.empresa_id;
  const pedido = await tx(async (c) => {
    const r = await c.query(
      'select id, numero, total, status from vendas where id = $1 and empresa_id = $2 for update',
      [req.params.id, emp]
    );
    if (!r.rows[0]) throw new HttpError(404, 'Pedido não encontrado.');
    if (r.rows[0].status === 'concluida') return { id: req.params.id, jaFinalizado: true };
    if (r.rows[0].status !== 'pendente') throw new HttpError(409, 'Este pedido já foi cancelado.');

    const caixaId = await caixaAberto(c, emp, req.user.id);
    const total = Number(r.rows[0].total);
    const pago = arred(d.pagamentos.reduce((s, p) => s + p.valor, 0));
    if (pago < total && !d.fiado) throw new HttpError(400, `Pagamento insuficiente: faltam R$ ${(total - pago).toFixed(2)}. Marque "fiado" para deixar o saldo em aberto.`);
    const troco = arred(pago - total);
    const emDinheiro = arred(d.pagamentos.filter((p) => p.forma === 'dinheiro').reduce((s, p) => s + p.valor, 0));
    if (troco > emDinheiro) throw new HttpError(400, 'O troco só pode sair de pagamento em dinheiro.');

    await c.query(
      `update vendas
          set status = 'concluida', usuario_id = $3, usuario_nome = $4,
              troco = $5, finalizada_em = now()
        where id = $1 and empresa_id = $2`,
      [req.params.id, emp, req.user.id, req.user.nome, troco]
    );
    for (const [index, p] of d.pagamentos.entries()) {
      await c.query(
        `insert into venda_pagamentos (venda_id, empresa_id, ordem, forma, valor, origem, caixa_id)
         values ($1, $2, $3, $4, $5, 'venda', $6)`,
        [req.params.id, emp, index + 1, p.forma, p.valor, caixaId]
      );
    }
    const cashPaid = arred(d.pagamentos.filter((p) => p.forma === 'dinheiro').reduce((s, p) => s + p.valor, 0) - troco);
    await movimentoCaixa(c, {
      caixaId, empresaId: emp, usuarioId: req.user.id, tipo: 'venda',
      valor: cashPaid, descricao: `Pedido ${r.rows[0].numero}`,
    });
    return { id: req.params.id };
  });
  res.json(pedido);
}));

router.post('/:id/cancelar', soVendedor, wrap(async (req, res) => {
  const emp = req.user.empresa_id;
  const pedido = await tx(async (c) => {
    const r = await c.query(
      'select id, status, vendedor_id from vendas where id = $1 and empresa_id = $2 for update',
      [req.params.id, emp]
    );
    if (!r.rows[0]) throw new HttpError(404, 'Pedido não encontrado.');
    if (r.rows[0].status !== 'pendente') throw new HttpError(409, 'Este pedido não está mais pendente.');
    if (req.user.perfil !== 'admin' && r.rows[0].vendedor_id !== req.user.id) {
      throw new HttpError(403, 'Você só pode cancelar os pedidos que criou.');
    }
    const libera = await c.query(
      `update produtos p set estoque = p.estoque + i.quantidade
         from venda_itens i
        where i.venda_id = $1 and i.produto_id = p.id and p.empresa_id = $2
          and i.estoque_reservado and i.quantidade_devolvida = 0
       returning p.id, p.descricao, p.estoque`,
      [req.params.id, emp]
    );
    for (const p of libera.rows) {
      const item = await c.query(
        `select quantidade from venda_itens where venda_id = $1 and produto_id = $2 and estoque_reservado`,
        [req.params.id, p.id]
      );
      const quantidade = item.rows.reduce((s, i) => s + Number(i.quantidade), 0);
      await c.query(
        `insert into estoque_movimentos
          (empresa_id, produto_id, produto_descricao, usuario_id, venda_id, tipo, variacao, estoque_apos, motivo)
         values ($1, $2, $3, $4, $5, 'liberacao_pedido', $6, $7, 'Pedido cancelado')`,
        [emp, p.id, p.descricao, req.user.id, req.params.id, quantidade, p.estoque]
      );
    }
    await c.query("update vendas set status = 'cancelada', cancelada_em = now() where id = $1", [req.params.id]);
    return carregarPedido(c, emp, req.params.id);
  });
  res.json(pedido);
}));

module.exports = router;
