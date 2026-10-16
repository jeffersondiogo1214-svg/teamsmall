const router = require('express').Router();
const { z } = require('zod');
const { query } = require('../db');
const { HttpError, wrap, parse, opt, arred } = require('../util');
const { soAdmin } = require('../auth');

const schema = z.object({
  codigo: z.string().trim().min(1).max(30),
  barras: opt(50),
  descricao: z.string().trim().min(1).max(160),
  unidade: z.string().trim().min(1).max(6).default('UN').transform((v) => v.toUpperCase()),
  preco: z.coerce.number().min(0).max(9999999).transform(arred),
  estoque: z.coerce.number().min(0).max(9999999).default(0),
  controla_estoque: z.boolean().default(true),
  ativo: z.boolean().default(true),
});
const COLS = 'id, codigo, barras, descricao, unidade, preco, estoque, controla_estoque, ativo';

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
  const { rows } = await query(
    `insert into produtos (empresa_id, codigo, barras, descricao, unidade, preco, estoque, controla_estoque, ativo)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning ${COLS}`,
    [req.user.empresa_id, d.codigo, d.barras, d.descricao, d.unidade, d.preco, d.estoque, d.controla_estoque, d.ativo]
  );
  res.status(201).json(rows[0]);
}));

router.put('/:id', soAdmin, wrap(async (req, res) => {
  const d = parse(schema, req.body);
  const { rows } = await query(
    `update produtos set codigo = $3, barras = $4, descricao = $5, unidade = $6, preco = $7,
            estoque = $8, controla_estoque = $9, ativo = $10
      where id = $1 and empresa_id = $2 returning ${COLS}`,
    [req.params.id, req.user.empresa_id, d.codigo, d.barras, d.descricao, d.unidade, d.preco, d.estoque, d.controla_estoque, d.ativo]
  );
  if (!rows[0]) throw new HttpError(404, 'Produto não encontrado.');
  res.json(rows[0]);
}));

/* Não apaga: inativa, para preservar o histórico das vendas */
router.delete('/:id', soAdmin, wrap(async (req, res) => {
  const r = await query('update produtos set ativo = false where id = $1 and empresa_id = $2', [req.params.id, req.user.empresa_id]);
  if (!r.rowCount) throw new HttpError(404, 'Produto não encontrado.');
  res.status(204).end();
}));

module.exports = router;
