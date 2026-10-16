const { Pool, types } = require('pg');

types.setTypeParser(1700, (v) => parseFloat(v)); // numeric -> number
types.setTypeParser(20, (v) => parseInt(v, 10)); // bigint (count) -> number

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
});
pool.on('error', (e) => console.error('Erro no pool do Postgres:', e.message));

const query = (text, params) => pool.query(text, params);

/* Executa fn dentro de uma transação: qualquer erro desfaz tudo. */
async function tx(fn) {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const r = await fn(c);
    await c.query('COMMIT');
    return r;
  } catch (e) {
    try { await c.query('ROLLBACK'); } catch (_) { /* conexão já encerrada */ }
    throw e;
  } finally {
    c.release();
  }
}

module.exports = { pool, query, tx };
