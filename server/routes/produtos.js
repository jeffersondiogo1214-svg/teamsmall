const router = require('express').Router();
const { z } = require('zod');
const { query, tx } = require('../db');
const { HttpError, wrap, parse, opt, arred } = require('../util');
const { soAdmin } = require('../auth');

const schema = z.object({
  codigo: z.string().trim().min(1).max(30),
  barras: opt(50),
  descricao: z.string().trim().min(1).max(160),
  categoria: opt(80),
  imagem_url: z.preprocess((v) => v === '' ? null : v, z.string().trim().url().max(500).nullish()),
  unidade: z.string().trim().min(1).max(6).default('UN').transform((v) => v.toUpperCase()),
  preco: z.coerce.number().min(0).max(9999999).transform(arred),
  estoque: z.coerce.number().min(0).max(9999999).default(0),
  estoque_minimo: z.coerce.number().min(0).max(9999999).default(0),
  controla_estoque: z.boolean().default(true),
  ativo: z.boolean().default(true),
});
const COLS = 'id, codigo, barras, descricao, categoria, imagem_url, unidade, preco, estoque, estoque_minimo, controla_estoque, ativo';

router.get('/:id/movimentos', soAdmin, wrap(async (req, res) => {
  const { rows } = await query(
    `select id, tipo, variacao, estoque_apos, motivo, criado_em
       from estoque_movimentos
      where empresa_id = $1 and produto_id = $2
      order by criado_em desc limit 200`,
    [req.user.empresa_id, req.params.id]
  );
  res.json(rows);
}));

router.post('/:id/estoque', soAdmin, wrap(async (req, res) => {
  const d = parse(z.object({
    tipo: z.enum(['entrada', 'ajuste']),
    quantidade: z.coerce.number().min(0).max(9999999),
    motivo: z.string().trim().min(3).max(200),
  }).superRefine((value, ctx) => {
    if (value.tipo === 'entrada' && value.quantidade <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['quantidade'], message: 'A entrada deve ser maior que zero.' });
    }
  }), req.body);
  const movimento = await tx(async (c) => {
    const r = await c.query(
      `select id, descricao, estoque from produtos
        where id = $1 and empresa_id = $2 and controla_estoque
        for update`,
      [req.params.id, req.user.empresa_id]
    );
    if (!r.rows[0]) throw new HttpError(404, 'Produto não encontrado ou sem controle de estoque.');
    const p = r.rows[0];
    const anterior = Number(p.estoque);
    const estoque = d.tipo === 'entrada' ? anterior + d.quantidade : d.quantidade;
    const variacao = estoque - anterior;
    if (variacao === 0) return { estoque, movimento: null };
    await c.query('update produtos set estoque = $2 where id = $1', [p.id, estoque]);
    const { rows } = await c.query(
      `insert into estoque_movimentos
        (empresa_id, produto_id, produto_descricao, usuario_id, tipo, variacao, estoque_apos, motivo)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       returning id, tipo, variacao, estoque_apos, motivo, criado_em`,
      [req.user.empresa_id, p.id, p.descricao, req.user.id, d.tipo, variacao, estoque, d.motivo]
    );
    return { estoque, movimento: rows[0] };
  });
  res.status(201).json(movimento);
}));

router.get('/', wrap(async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 60);
  const like = q.replace(/[\\%_]/g, '\\$&');
  const limite = Math.min(parseInt(req.query.limite, 10) || 100, 200);
  const soAtivos = req.query.ativos === '1';
  const { rows } = await query(
    `select ${COLS} from produtos
      where empresa_id = $1
        and ($2 = '' or descricao ilike '%' || $5 || '%' or codigo ilike $5 || '%' or barras = $2)
        and (not $3 or ativo)
      order by (codigo = $2 or coalesce(barras = $2, false)) desc, descricao
      limit $4`,
    [req.user.empresa_id, q, soAtivos, limite, like]
  );
  res.json(rows);
}));

router.post('/', soAdmin, wrap(async (req, res) => {
  const d = parse(schema, req.body);
  const produto = await tx(async (c) => {
    const { rows } = await c.query(
      `insert into produtos (empresa_id, codigo, barras, descricao, categoria, imagem_url, unidade, preco, estoque, estoque_minimo, controla_estoque, ativo)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) returning ${COLS}`,
      [req.user.empresa_id, d.codigo, d.barras, d.descricao, d.categoria, d.imagem_url, d.unidade,
        d.preco, d.estoque, d.estoque_minimo, d.controla_estoque, d.ativo]
    );
    if (d.controla_estoque && d.estoque > 0) {
      await c.query(
        `insert into estoque_movimentos
          (empresa_id, produto_id, produto_descricao, usuario_id, tipo, variacao, estoque_apos, motivo)
         values ($1, $2, $3, $4, 'entrada', $5, $5, 'Estoque inicial no cadastro')`,
        [req.user.empresa_id, rows[0].id, d.descricao, req.user.id, d.estoque]
      );
    }
    return rows[0];
  });
  res.status(201).json(produto);
}));

router.put('/:id', soAdmin, wrap(async (req, res) => {
  const d = parse(schema, req.body);
  const produto = await tx(async (c) => {
    const anterior = await c.query(
      'select estoque from produtos where id = $1 and empresa_id = $2 for update',
      [req.params.id, req.user.empresa_id]
    );
    if (!anterior.rows[0]) throw new HttpError(404, 'Produto não encontrado.');
    const { rows } = await c.query(
      `update produtos set codigo = $3, barras = $4, descricao = $5, categoria = $6, imagem_url = $7,
              unidade = $8, preco = $9, estoque = $10, estoque_minimo = $11,
              controla_estoque = $12, ativo = $13
        where id = $1 and empresa_id = $2 returning ${COLS}`,
      [req.params.id, req.user.empresa_id, d.codigo, d.barras, d.descricao, d.categoria, d.imagem_url,
        d.unidade, d.preco, d.estoque, d.estoque_minimo, d.controla_estoque, d.ativo]
    );
    const variacao = Number(d.estoque) - Number(anterior.rows[0].estoque);
    if (variacao) {
      await c.query(
        `insert into estoque_movimentos
          (empresa_id, produto_id, produto_descricao, usuario_id, tipo, variacao, estoque_apos, motivo)
         values ($1, $2, $3, $4, 'ajuste', $5, $6, 'Estoque ajustado ao editar cadastro')`,
        [req.user.empresa_id, req.params.id, d.descricao, req.user.id, variacao, d.estoque]
      );
    }
    return rows[0];
  });
  res.json(produto);
}));

/* Não apaga: inativa, para preservar o histórico das vendas */
router.delete('/:id', soAdmin, wrap(async (req, res) => {
  const r = await query('update produtos set ativo = false where id = $1 and empresa_id = $2', [req.params.id, req.user.empresa_id]);
  if (!r.rowCount) throw new HttpError(404, 'Produto não encontrado.');
  res.status(204).end();
}));

module.exports = router;
