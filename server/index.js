require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const fatal = (msg) => { console.error(msg); process.exit(1); };
const dist = path.join(__dirname, '..', 'client', 'dist');
const indexHtml = path.join(dist, 'index.html');
if (!fs.existsSync(indexHtml)) fatal('Front-end não compilado. Rode "npm run build" antes de iniciar o serviço.');
if (!process.env.DATABASE_URL) fatal('Defina DATABASE_URL (veja .env.example).');
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) fatal('Defina JWT_SECRET com pelo menos 16 caracteres (veja .env.example).');

const { pool, query } = require('./db');
const { autenticar } = require('./auth');

const app = express();
app.set('trust proxy', 1); // Render fica atrás de um proxy
app.use(helmet({ contentSecurityPolicy: { useDefaults: true, directives: { 'upgrade-insecure-requests': null } } }));
app.use(express.json({ limit: '100kb' }));

app.get('/health', async (req, res) => {
  try {
    await query('select 1');
    res.json({ ok: true });
  } catch (_) {
    res.status(503).json({ ok: false });
  }
});

/* Freia tentativas de login/cadastro: só as que falham contam */
app.post(['/api/auth/login', '/api/auth/registrar'], rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: 'Muitas tentativas. Tente novamente em alguns minutos.' },
}));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/produtos', autenticar, require('./routes/produtos'));
app.use('/api/clientes', autenticar, require('./routes/clientes'));
app.use('/api/vendas', autenticar, require('./routes/vendas'));
app.use('/api/pedidos', autenticar, require('./routes/pedidos'));
app.use('/api/caixa', autenticar, require('./routes/caixa'));
app.use('/api/dashboard', autenticar, require('./routes/dashboard'));
app.use('/api/relatorios', autenticar, require('./routes/relatorios'));
app.use('/api', require('./routes/admin'));
app.use('/api', (req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }));

/* Front-end (React) compilado */
app.use(express.static(dist, {
  setHeaders: (res, file) => {
    if (file.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
    else if (file.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  },
}));
app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));

const DUPLICADOS = {
  usuarios_email_uq: 'Este e-mail já está em uso.',
  produtos_empresa_id_codigo_key: 'Já existe um produto com este código.',
  vendas_empresa_id_chave_key: 'Esta venda já foi registrada.',
};

app.use((err, req, res, next) => {
  let status = err.status || 500;
  let msg = err.message;
  if (err.type === 'entity.parse.failed') { status = 400; msg = 'JSON inválido.'; }
  else if (err.code === '22P02') { status = 400; msg = 'Identificador inválido.'; }
  else if (err.code === '23505') { status = 409; msg = DUPLICADOS[err.constraint] || 'Registro duplicado.'; }
  else if (err.code === '23514') { status = 400; msg = 'Valor fora do permitido.'; }
  else if (err.code === '40P01' || err.code === '40001') { status = 503; msg = 'Muitas operações ao mesmo tempo. Tente novamente.'; }
  else if (status >= 500) { console.error(err); msg = 'Erro interno. Tente novamente.'; }
  res.status(status).json({ erro: msg });
});

process.on('unhandledRejection', (e) => console.error('Erro não tratado:', e));

const PORT = Number(process.env.PORT || 3000);
query('select 1 from empresas limit 1')
  .then(() => {
    const server = app.listen(PORT, () => console.log(`Vendas SaaS rodando na porta ${PORT}`));
    const parar = () => {
      server.close(() => pool.end().then(() => process.exit(0)));
      setTimeout(() => process.exit(0), 10000).unref();
    };
    process.on('SIGTERM', parar);
    process.on('SIGINT', parar);
  })
  .catch((e) => fatal(`Banco inacessível ou schema não aplicado (${e.message}). Confira DATABASE_URL e rode: npm run db:init`));
