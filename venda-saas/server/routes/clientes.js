const router = require('express').Router();
const { z } = require('zod');
const { query } = require('../db');
const { HttpError, wrap, parse, opt } = require('../util');

const schema = z.object({
  nome: z.string().trim().min(2).max(120),
  documento: opt(20),
  telefone: opt(30),
  email: opt(160),
  endereco: opt(200),
});
const COLS = 'id, nome, documento, telefone, email, endereco';

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
