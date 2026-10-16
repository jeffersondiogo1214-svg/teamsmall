const jwt = require('jsonwebtoken');
const { query } = require('./db');
const { HttpError, wrap } = require('./util');

const SECRET = process.env.JWT_SECRET;

const assinar = (userId) => jwt.sign({ sub: userId }, SECRET, { algorithm: 'HS256', expiresIn: '12h' });

/* Valida o token e carrega o usuário atual (e a empresa dele) a cada requisição.
   Assim, desativar um usuário bloqueia o acesso na hora. */
const autenticar = wrap(async (req, res, next) => {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) throw new HttpError(401, 'Faça login para continuar.');
  let payload;
  try {
    payload = jwt.verify(token, SECRET, { algorithms: ['HS256'] });
  } catch (_) {
    throw new HttpError(401, 'Sessão expirada. Entre novamente.');
  }
  const { rows } = await query(
    'select id, nome, email, perfil, empresa_id from usuarios where id = $1 and ativo',
    [payload.sub]
  );
  if (!rows[0]) throw new HttpError(401, 'Usuário inativo ou inexistente.');
  req.user = rows[0];
  next();
});

const soAdmin = (req, res, next) =>
  req.user.perfil === 'admin' ? next() : next(new HttpError(403, 'Apenas administradores podem fazer isso.'));

const soCaixa = (req, res, next) =>
  ['admin', 'caixa'].includes(req.user.perfil) ? next() : next(new HttpError(403, 'Apenas o caixa pode finalizar vendas.'));

const soVendedor = (req, res, next) =>
  ['admin', 'vendedor'].includes(req.user.perfil) ? next() : next(new HttpError(403, 'Apenas vendedores podem criar pedidos.'));

module.exports = { assinar, autenticar, soAdmin, soCaixa, soVendedor };
