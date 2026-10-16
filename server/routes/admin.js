const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { query } = require('../db');
const { HttpError, wrap, parse, opt, email } = require('../util');
const { autenticar, soAdmin } = require('../auth');

const adm = [autenticar, soAdmin];
const nome = z.string().trim().min(2).max(120);
const perfil = z.enum(['admin', 'caixa', 'vendedor']);

router.put('/empresa', adm, wrap(async (req, res) => {
  const d = parse(z.object({ nome, documento: opt(30), telefone: opt(30), endereco: opt(200) }), req.body);
  const { rows } = await query(
    `update empresas set nome = $2, documento = $3, telefone = $4, endereco = $5
      where id = $1 returning id, nome, documento, telefone, endereco`,
    [req.user.empresa_id, d.nome, d.documento, d.telefone, d.endereco]
  );
  res.json(rows[0]);
}));

router.get('/usuarios', adm, wrap(async (req, res) => {
  const { rows } = await query(
    'select id, nome, email, perfil, ativo from usuarios where empresa_id = $1 order by nome',
    [req.user.empresa_id]
  );
  res.json(rows);
}));

router.post('/usuarios', adm, wrap(async (req, res) => {
  const d = parse(z.object({ nome, email, senha: z.string().min(8).max(100), perfil }), req.body);
  const hash = await bcrypt.hash(d.senha, 10);
  const { rows } = await query(
    `insert into usuarios (empresa_id, nome, email, senha_hash, perfil)
     values ($1, $2, $3, $4, $5) returning id, nome, email, perfil, ativo`,
    [req.user.empresa_id, d.nome, d.email, hash, d.perfil]
  );
  res.status(201).json(rows[0]);
}));

router.put('/usuarios/:id', adm, wrap(async (req, res) => {
  const d = parse(z.object({ nome, perfil, ativo: z.boolean(), senha: z.string().max(100).nullish() }), req.body);
  if (req.params.id.toLowerCase() === req.user.id && (!d.ativo || d.perfil !== 'admin')) {
    throw new HttpError(400, 'Você não pode desativar nem rebaixar o seu próprio usuário.');
  }
  if (d.senha && d.senha.length < 8) throw new HttpError(400, 'senha: mínimo de 8 caracteres');
  const hash = d.senha ? await bcrypt.hash(d.senha, 10) : null;
  const { rows } = await query(
    `update usuarios set nome = $3, perfil = $4, ativo = $5, senha_hash = coalesce($6, senha_hash)
      where id = $1 and empresa_id = $2 returning id, nome, email, perfil, ativo`,
    [req.params.id, req.user.empresa_id, d.nome, d.perfil, d.ativo, hash]
  );
  if (!rows[0]) throw new HttpError(404, 'Usuário não encontrado.');
  res.json(rows[0]);
}));

module.exports = router;
