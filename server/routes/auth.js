const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { query, tx } = require('../db');
const { HttpError, wrap, parse, email } = require('../util');
const { assinar, autenticar } = require('../auth');

const DUMMY_HASH = bcrypt.hashSync('senha-falsa-para-igualar-o-tempo', 10);

async function sessao(userId) {
  const { rows } = await query(
    `select u.id, u.nome, u.email, u.perfil,
            e.id as empresa_id, e.nome as empresa_nome, e.documento, e.telefone, e.endereco,
            e.comissao_percentual
       from usuarios u join empresas e on e.id = u.empresa_id
      where u.id = $1`,
    [userId]
  );
  const r = rows[0];
  return {
    usuario: { id: r.id, nome: r.nome, email: r.email, perfil: r.perfil },
    empresa: {
      id: r.empresa_id, nome: r.empresa_nome, documento: r.documento,
      telefone: r.telefone, endereco: r.endereco, comissao_percentual: r.comissao_percentual,
    },
  };
}

/* Cria a empresa e o primeiro usuário (administrador) */
router.post('/registrar', wrap(async (req, res) => {
  const d = parse(
    z.object({
      empresa: z.string().trim().min(2).max(120),
      nome: z.string().trim().min(2).max(120),
      email,
      senha: z.string().min(8).max(100),
    }),
    req.body
  );
  const hash = await bcrypt.hash(d.senha, 10);
  const userId = await tx(async (c) => {
    const e = await c.query('insert into empresas (nome) values ($1) returning id', [d.empresa]);
    const u = await c.query(
      `insert into usuarios (empresa_id, nome, email, senha_hash, perfil)
       values ($1, $2, $3, $4, 'admin') returning id`,
      [e.rows[0].id, d.nome, d.email, hash]
    );
    return u.rows[0].id;
  });
  res.status(201).json({ token: assinar(userId), ...(await sessao(userId)) });
}));

router.post('/login', wrap(async (req, res) => {
  const d = parse(z.object({ email, senha: z.string().min(1).max(100) }), req.body);
  const { rows } = await query('select id, senha_hash, ativo from usuarios where lower(email) = $1', [d.email]);
  const u = rows[0];
  const ok = await bcrypt.compare(d.senha, u ? u.senha_hash : DUMMY_HASH);
  if (!u || !ok || !u.ativo) throw new HttpError(401, 'E-mail ou senha incorretos.');
  res.json({ token: assinar(u.id), ...(await sessao(u.id)) });
}));

router.get('/eu', autenticar, wrap(async (req, res) => {
  res.json(await sessao(req.user.id));
}));

module.exports = router;
