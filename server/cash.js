const { HttpError } = require('./util');

async function caixaAberto(db, empresaId, usuarioId) {
  const { rows } = await db.query(
    `select id from caixas
      where empresa_id = $1 and usuario_id = $2 and fechado_em is null
      for update`,
    [empresaId, usuarioId]
  );
  if (!rows[0]) throw new HttpError(409, 'Abra o caixa antes de registrar esta operação.');
  return rows[0].id;
}

async function movimentoCaixa(db, { caixaId, empresaId, usuarioId, tipo, valor, descricao }) {
  if (!(valor > 0)) return;
  await db.query(
    `insert into caixa_movimentos (caixa_id, empresa_id, usuario_id, tipo, valor, descricao)
     values ($1, $2, $3, $4, $5, $6)`,
    [caixaId, empresaId, usuarioId, tipo, valor, descricao || null]
  );
}

module.exports = { caixaAberto, movimentoCaixa };
