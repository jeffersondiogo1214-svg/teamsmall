const router = require('express').Router();
const { z } = require('zod');
const { query, tx } = require('../db');
const { HttpError, wrap, parse, arred } = require('../util');
const { soCaixa } = require('../auth');
const { movimentoCaixa } = require('../cash');

const dinheiro = z.coerce.number().min(0).max(999999999).transform(arred);
const descricao = z.string().trim().min(2).max(200);

router.get('/atual', soCaixa, wrap(async (req, res) => {
  const { rows } = await query(
    `select c.id, c.aberto_em, c.valor_abertura,
            coalesce(sum(case when m.tipo in ('abertura', 'reforco', 'venda', 'cobranca') then m.valor
                              when m.tipo in ('retirada', 'devolucao') then -m.valor else 0 end), c.valor_abertura) as valor_esperado,
            coalesce(json_agg(json_build_object(
              'id', m.id, 'tipo', m.tipo, 'valor', m.valor, 'descricao', m.descricao, 'criado_em', m.criado_em
            ) order by m.criado_em desc) filter (where m.id is not null), '[]'::json) as movimentos
       from caixas c
       left join caixa_movimentos m on m.caixa_id = c.id
      where c.empresa_id = $1 and c.usuario_id = $2 and c.fechado_em is null
      group by c.id`,
    [req.user.empresa_id, req.user.id]
  );
  res.json(rows[0] || null);
}));

router.post('/abrir', soCaixa, wrap(async (req, res) => {
  const d = parse(z.object({ valorAbertura: dinheiro }), req.body);
  const result = await tx(async (c) => {
    const { rows } = await c.query(
      `insert into caixas (empresa_id, usuario_id, valor_abertura)
       values ($1, $2, $3) returning id, aberto_em, valor_abertura`,
      [req.user.empresa_id, req.user.id, d.valorAbertura]
    );
    await movimentoCaixa(c, {
      caixaId: rows[0].id, empresaId: req.user.empresa_id, usuarioId: req.user.id,
      tipo: 'abertura', valor: d.valorAbertura, descricao: 'Troco inicial',
    });
    return rows[0];
  });
  res.status(201).json(result);
}));

router.post('/movimentos', soCaixa, wrap(async (req, res) => {
  const d = parse(z.object({ tipo: z.enum(['reforco', 'retirada']), valor: dinheiro.refine((v) => v > 0), descricao }), req.body);
  const result = await tx(async (c) => {
    const caixa = await c.query(
      `select id from caixas where empresa_id = $1 and usuario_id = $2 and fechado_em is null for update`,
      [req.user.empresa_id, req.user.id]
    );
    if (!caixa.rows[0]) throw new HttpError(409, 'Abra o caixa antes de registrar movimentações.');
    if (d.tipo === 'retirada') {
      const saldo = await c.query(
        `select coalesce(sum(case when tipo in ('abertura', 'reforco', 'venda', 'cobranca') then valor
                                  when tipo in ('retirada', 'devolucao') then -valor else 0 end), 0) as valor
           from caixa_movimentos where caixa_id = $1`,
        [caixa.rows[0].id]
      );
      if (Number(saldo.rows[0].valor) < d.valor) throw new HttpError(400, 'A retirada não pode exceder o saldo disponível no caixa.');
    }
    await movimentoCaixa(c, {
      caixaId: caixa.rows[0].id, empresaId: req.user.empresa_id,
      usuarioId: req.user.id, tipo: d.tipo, valor: d.valor, descricao: d.descricao,
    });
    return { ok: true };
  });
  res.status(201).json(result);
}));

router.post('/fechar', soCaixa, wrap(async (req, res) => {
  const d = parse(z.object({ valorContado: dinheiro }), req.body);
  const result = await tx(async (c) => {
    const { rows } = await c.query(
      `select id, valor_abertura from caixas
        where empresa_id = $1 and usuario_id = $2 and fechado_em is null
        for update`,
      [req.user.empresa_id, req.user.id]
    );
    if (!rows[0]) throw new HttpError(409, 'Não há caixa aberto para fechar.');
    const { rows: movimentos } = await c.query(
      `select coalesce(sum(case when tipo in ('abertura', 'reforco', 'venda', 'cobranca') then valor
                                when tipo in ('retirada', 'devolucao') then -valor else 0 end), 0) as esperado
         from caixa_movimentos where caixa_id = $1`,
      [rows[0].id]
    );
    const esperado = arred(Number(movimentos[0].esperado));
    const diferenca = arred(d.valorContado - esperado);
    const { rows: fechado } = await c.query(
      `update caixas
          set fechado_em = now(), valor_esperado = $2, valor_contado = $3, diferenca = $4
        where id = $1
        returning id, fechado_em, valor_esperado, valor_contado, diferenca`,
      [rows[0].id, esperado, d.valorContado, diferenca]
    );
    return fechado[0];
  });
  res.json(result);
}));

module.exports = router;
