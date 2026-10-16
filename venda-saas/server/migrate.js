/* Aplica supabase/schema.sql no banco apontado por DATABASE_URL: npm run db:init */
require('dotenv').config();
const fs = require('fs');
const path = require('path');

if (!process.env.DATABASE_URL) {
  console.error('Defina DATABASE_URL no .env antes de rodar.');
  process.exit(1);
}
const { pool } = require('./db');

(async () => {
  await pool.query(fs.readFileSync(path.join(__dirname, '..', 'supabase', 'schema.sql'), 'utf8'));
  console.log('Schema aplicado com sucesso.');
  await pool.end();
})().catch((e) => {
  console.error('Falha ao aplicar o schema:', e.message);
  process.exit(1);
});
