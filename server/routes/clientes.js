const router = require('express').Router();
const { z } = require('zod');
const { z } = require('zod');
const { query, tx } = require('../db');
const { HttpError, wrap, parse, opt, arred } = require('../util');
const { soCaixa } = require('../auth');
const { caixaAberto, movimentoCaixa } = require('../cash');

const schema = z.object({
  nome: z.string().trim().min(2).max(120),
  documento: opt(20),
  telefone: opt(30),
  email: opt(160),
  endereco: opt(200),
});
const COLS = 'id, nome, documento, telefone, email, endereco';

router.get('/:id/historico', wrap(async (req, res) => {
  const cliente = await query(
    `select id, nome, documento, telefone from clientes where id = $1 and empresa_id = $2 and ativo`,
    [req.params.id, req.user.empresa_id]
  );
  if (!cliente.rows[0]) throw new HttpError(404, 'Cliente não encontrado.');
  const vendas = await query(
    `select v.id, v.numero, v.status, coalesce(v.finalizada_em, v.criado_em) as data,
            v.total, coalesce(pg.valor_pago, 0) as pago,
            coalesce(dev.valor_devolvido, 0) as devolvido,
            greatest(v.total - coalesce(pg.valor_pago, 0) - coalesce(dev.valor_devolvido, 0), 0) as saldo_devedor
       from vendas v
       left join lateral (select sum(valor) as valor_pago from venda_pagamentos where venda_id = v.id) pg on true
       left join lateral (select sum(valor) as valor_devolvido from venda_devolucoes where venda_id = v.id) dev on true
      where v.empresa_id = $1 and v.cliente_id = $2 and v.status <> 'pendente'
      order by coalesce(v.finalizada_em, v.criado_em) desc
      limit 200`,
    [req.user.empresa_id, req.params.id]
  );
  const resumo = await query(
    `select count(*)::int as compras,
            coalesce(sum(v.total - coalesce(dev.valor, 0)) filter (where v.status = 'concluida'), 0) as total_comprado,
            coalesce(sum(greatest(v.total - coalesce(pg.valor, 0) - coalesce(dev.valor, 0), 0))
              filter (where v.status = 'concluida'), 0) as saldo_devedor
       from vendas v
       left join lateral (select sum(valor) as valor from venda_pagamentos where venda_id = v.id) pg on true
       left join lateral (select sum(valor) as valor from venda_devolucoes where venda_id = v.id) dev on true
      where v.empresa_id = $1 and v.cliente_id = $2 and v.status <> 'pendente'`,
    [req.user.empresa_id, req.params.id]
  );
  res.json({ cliente: cliente.rows[0], resumo: resumo.rows[0], vendas: vendas.rows });
}));

router.post('/:id/cobrancas', soCaixa, wrap(async (req, res) => {
  const d = parse(z.object({
    vendaId: z.string().uuid(),
    forma: z.enum(['dinheiro', 'pix', 'debito', 'credito']),
    valor: z.coerce.number().min(0.01).max(9999999).transform(arred),
  }), req.body);
  const result = await tx(async (c) => {
    const venda = await c.query(
      `select id, numero, total from vendas
        where id = $1 and empresa_id = $2 and cliente_id = $3 and status = 'concluida'
        for update`,
      [d.vendaId, req.user.empresa_id, req.params.id]
    );
    if (!venda.rows[0]) throw new HttpError(404, 'Venda em aberto não encontrada para este cliente.');
    const aberto = await c.query(
      `select greatest($2::numeric
                  - coalesce((select sum(valor) from venda_pagamentos where venda_id = $1), 0)
                  - coalesce((select sum(valor) from venda_devolucoes where venda_id = $1), 0), 0) as saldo`,
      [d.vendaId, venda.rows[0].total]
    );
    if (d.valor > Number(aberto.rows[0].saldo)) throw new HttpError(400, 'O recebimento não pode ultrapassar o saldo em aberto.');
    const caixaId = await caixaAberto(c, req.user.empresa_id, req.user.id);
    const ordem = await c.query(
      'select coalesce(max(ordem), 0) + 1 as ordem from venda_pagamentos where venda_id = $1',
      [d.vendaId]
    );
    const pagamento = await c.query(
      `insert into venda_pagamentos (venda_id, empresa_id, ordem, forma, valor, origem, caixa_id)
       values ($1, $2, $3, $4, $5, 'cobranca', $6)
       returning id, forma, valor, origem`,
      [d.vendaId, req.user.empresa_id, ordem.rows[0].ordem, d.forma, d.valor, caixaId]
    );
    await movimentoCaixa(c, {
      caixaId, empresaId: req.user.empresa_id, usuarioId: req.user.id,
      tipo: 'cobranca', valor: d.forma === 'dinheiro' ? d.valor : 0,
      descricao: `Recebimento da venda ${venda.rows[0].numero}`,
    });
    return pagamento.rows[0];
  });
  res.status(201).json(result);
}));

router.get('/', wrap(async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 60);
  const like = q.replace(/[\\%_]/g, '\\$&');
  const limite = Math.min(parseInt(req.query.limite, 10) || 100, 200);
  const { rows } = await query(
    `select ${COLS} from clientes
      where empresa_id = $1 and ativo
        and ($2 = '' or nome ilike '%' || $3 || '%' or documento ilike '%' || $3 || '%' or telefone ilike '%' || $3 || '%')
      order by nome limit $4`,
    [req.user.empresa_id, q, like, limite]
  );
  res.json(rows);
}));

router.post('/', wrap(async (req, res) => {
  const d = parse(schema, req.body);
  const { rows } = await query(
    `insert into clientes (empresa_id, nome, documento, telefone, email, endereco)
     values ($1, $2, $3, $4, $5, $6) returning ${COLS}`,
    [req.user.empresa_id, d.nome, d.documento, d.telefone, d.email, d.endereco]
  );
  res.status(201).json(rows[0]);
}));

router.put('/:id', wrap(async (req, res) => {
  const d = parse(schema, req.body);
  const { rows } = await query(
    `update clientes set nome = $3, documento = $4, telefone = $5, email = $6, endereco = $7
      where id = $1 and empresa_id = $2 and ativo returning ${COLS}`,
    [req.params.id, req.user.empresa_id, d.nome, d.documento, d.telefone, d.email, d.endereco]
  );
  if (!rows[0]) throw new HttpError(404, 'Cliente não encontrado.');
  res.json(rows[0]);
}));

router.delete('/:id', wrap(async (req, res) => {
  const r = await query('update clientes set ativo = false where id = $1 and empresa_id = $2', [req.params.id, req.user.empresa_id]);
  if (!r.rowCount) throw new HttpError(404, 'Cliente não encontrado.');
  res.status(204).end();
}));

module.exports = router;
