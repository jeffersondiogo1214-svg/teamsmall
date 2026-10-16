const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { query } = require('../db');
const { HttpError, wrap, parse, opt, email } = require('../util');
const { autenticar, soAdmin } = require('../auth');

const adm = [autenticar, soAdmin];
const nome = z.string().trim().min(2).max(120);
const perfil = z.enum(['admin', 'caixa', 'vendedor']);
const percentual = z.coerce.number().min(0).max(100);

router.put('/empresa', adm, wrap(async (req, res) => {
  const d = parse(z.object({
    nome, documento: opt(30), telefone: opt(30), endereco: opt(200),
    comissao_percentual: percentual.default(0),
  }), req.body);
  const { rows } = await query(
    `update empresas set nome = $2, documento = $3, telefone = $4, endereco = $5, comissao_percentual = $6
      where id = $1 returning id, nome, documento, telefone, endereco, comissao_percentual`,
    [req.user.empresa_id, d.nome, d.documento, d.telefone, d.endereco, d.comissao_percentual]
  );
  res.json(rows[0]);
}));

router.get('/usuarios', adm, wrap(async (req, res) => {
  const { rows } = await query(
    'select id, nome, email, perfil, ativo, comissao_percentual from usuarios where empresa_id = $1 order by nome',
    [req.user.empresa_id]
  );
  res.json(rows);
}));

router.post('/usuarios', adm, wrap(async (req, res) => {
  const d = parse(z.object({
    nome, email, senha: z.string().min(8).max(100), perfil,
    comissao_percentual: percentual.nullish(),
  }), req.body);
  const hash = await bcrypt.hash(d.senha, 10);
  const { rows } = await query(
    `insert into usuarios (empresa_id, nome, email, senha_hash, perfil, comissao_percentual)
     values ($1, $2, $3, $4, $5, $6) returning id, nome, email, perfil, ativo, comissao_percentual`,
    [req.user.empresa_id, d.nome, d.email, hash, d.perfil, d.comissao_percentual ?? null]
  );
  res.status(201).json(rows[0]);
}));

router.put('/usuarios/:id', adm, wrap(async (req, res) => {
  const d = parse(z.object({
    nome, perfil, ativo: z.boolean(), senha: z.string().max(100).nullish(),
    comissao_percentual: percentual.nullish(),
  }), req.body);
  if (req.params.id.toLowerCase() === req.user.id && (!d.ativo || d.perfil !== 'admin')) {
    throw new HttpError(400, 'Você não pode desativar nem rebaixar o seu próprio usuário.');
  }
  if (d.senha && d.senha.length < 8) throw new HttpError(400, 'senha: mínimo de 8 caracteres');
  const hash = d.senha ? await bcrypt.hash(d.senha, 10) : null;
  const { rows } = await query(
    `update usuarios set nome = $3, perfil = $4, ativo = $5, senha_hash = coalesce($6, senha_hash),
                         comissao_percentual = $7
      where id = $1 and empresa_id = $2 returning id, nome, email, perfil, ativo, comissao_percentual`,
    [req.params.id, req.user.empresa_id, d.nome, d.perfil, d.ativo, hash, d.comissao_percentual ?? null]
  );
  if (!rows[0]) throw new HttpError(404, 'Usuário não encontrado.');
  res.json(rows[0]);
}));

module.exports = router;
