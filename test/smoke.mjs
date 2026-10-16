/* Teste de ponta a ponta contra um servidor rodando: npm start (em outro terminal) e depois npm test.
   Usa BASE_URL se o servidor não estiver em http://localhost:3000. Cria empresas de teste no banco. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const sufixo = Date.now().toString(36);

async function api(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { ...(body && { 'Content-Type': 'application/json' }), ...(token && { Authorization: `Bearer ${token}` }) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = res.status === 204 ? null : await res.json().catch(() => ({}));
  return { status: res.status, data };
}
const esperar = async (status, path, opts) => {
  const r = await api(path, opts);
  assert.equal(r.status, status, `${opts?.method || 'GET'} ${path} => ${r.status} ${JSON.stringify(r.data)}`);
  return r.data;
};
const passo = (t) => console.log(`ok  ${t}`);

const registrar = (nome) =>
  esperar(201, '/auth/registrar', { method: 'POST', body: { empresa: `Loja ${nome}`, nome, email: `${nome}-${sufixo}@teste.com`, senha: 'senha-forte-1' } });

const A = await registrar('ana');
const B = await registrar('bia');
const ta = A.token;
const tb = B.token;
passo('duas empresas criadas, cada uma com seu administrador');

await esperar(401, '/produtos');
await esperar(401, '/auth/login', { method: 'POST', body: { email: `ana-${sufixo}@teste.com`, senha: 'errada-errada' } });
passo('sem token e senha errada são barrados');

const caneta = await esperar(201, '/produtos', { method: 'POST', token: ta, body: { codigo: '001', barras: '7890001', descricao: 'Caneta', preco: 10.5, estoque: 5 } });
await esperar(409, '/produtos', { method: 'POST', token: ta, body: { codigo: '001', descricao: 'Repetido', preco: 1 } });
const cliente = await esperar(201, '/clientes', { method: 'POST', token: ta, body: { nome: 'Maria Souza', documento: '00000000000', telefone: '81999990000' } });
assert.equal((await esperar(200, '/produtos?q=7890001', { token: ta }))[0].id, caneta.id);
passo('produto (código único por empresa), busca por código de barras e cliente');

assert.equal((await esperar(200, '/produtos', { token: tb })).length, 0);
await esperar(404, `/produtos/${caneta.id}`, { method: 'PUT', token: tb, body: { codigo: 'x', descricao: 'x', preco: 1 } });
passo('empresa B não enxerga nem altera dados da empresa A');

const item = (q) => ({ produtoId: caneta.id, quantidade: q });
const chave = randomUUID();
const v1 = await esperar(201, '/vendas', { method: 'POST', token: ta, body: { chave, clienteId: cliente.id, itens: [item(2)], pagamentos: [{ forma: 'dinheiro', valor: 30 }] } });
assert.deepEqual([v1.numero, v1.subtotal, v1.total, v1.troco, v1.cliente_nome], [1, 21, 21, 9, 'Maria Souza']);
assert.equal(v1.itens.length, 1);
assert.equal(v1.empresa.nome, 'Loja ana');
const estoque = async (t = ta) => (await esperar(200, '/produtos?q=001', { token: t }))[0].estoque;
assert.equal(await estoque(), 3);
passo('venda no PDV: total 21,00, troco 9,00, estoque 5 -> 3');

const repetida = await esperar(200, '/vendas', { method: 'POST', token: ta, body: { chave, itens: [item(2)], pagamentos: [{ forma: 'dinheiro', valor: 30 }] } });
assert.equal(repetida.id, v1.id);
assert.equal(await estoque(), 3);
passo('reenvio da mesma venda não duplica nem baixa estoque duas vezes');

await esperar(409, '/vendas', { method: 'POST', token: ta, body: { itens: [item(10)], pagamentos: [{ forma: 'pix', valor: 105 }] } });
await esperar(400, '/vendas', { method: 'POST', token: ta, body: { itens: [item(1)], pagamentos: [{ forma: 'pix', valor: 5 }] } });
await esperar(400, '/vendas', { method: 'POST', token: ta, body: { itens: [item(1)], pagamentos: [{ forma: 'pix', valor: 20 }] } });
await esperar(400, '/vendas', { method: 'POST', token: ta, body: { itens: [item(1)], desconto: 50, pagamentos: [{ forma: 'pix', valor: 10.5 }] } });
assert.equal(await estoque(), 3);
passo('estoque insuficiente, pagamento curto, troco fora do dinheiro e desconto absurdo: recusados sem mexer no estoque');

const v2 = await esperar(201, '/vendas', { method: 'POST', token: ta, body: { itens: [item(1)], desconto: 0.5, pagamentos: [{ forma: 'pix', valor: 5 }, { forma: 'credito', valor: 5 }] } });
assert.deepEqual([v2.numero, v2.total, v2.troco, v2.pagamentos.length], [2, 10, 0, 2]);
passo('venda com desconto e pagamento dividido (PIX + crédito)');

await esperar(404, `/vendas/${v1.id}`, { token: tb });
passo('empresa B não lê vendas da empresa A');

const lista = await esperar(200, '/vendas?de=2000-01-01&ate=2100-01-01', { token: ta });
assert.deepEqual(lista.map((v) => v.numero), [2, 1]);
assert.equal((await esperar(200, '/vendas?q=Maria', { token: ta })).length, 1);
passo('listagem por período e busca por nome do cliente');

const sacola = await esperar(201, '/produtos', { method: 'POST', token: ta, body: { codigo: '002', descricao: 'Sacola', preco: 1, estoque: 3 } });
const corrida = await Promise.all(Array.from({ length: 5 }, () =>
  api('/vendas', { method: 'POST', token: ta, body: { itens: [{ produtoId: sacola.id, quantidade: 1 }], pagamentos: [{ forma: 'pix', valor: 1 }] } })));
const status = corrida.map((r) => r.status).sort();
assert.deepEqual(status, [201, 201, 201, 409, 409]);
const numeros = corrida.filter((r) => r.status === 201).map((r) => r.data.numero);
assert.equal(new Set(numeros).size, 3);
assert.equal((await esperar(200, '/produtos?q=002', { token: ta }))[0].estoque, 0);
passo('5 vendas simultâneas para 3 unidades: 3 passam, 2 recusadas, números sem repetição, estoque 0');

const cancelada = await esperar(200, `/vendas/${v1.id}/cancelar`, { method: 'POST', token: ta });
assert.equal(cancelada.status, 'cancelada');
assert.equal(await estoque(), 4);
await esperar(409, `/vendas/${v1.id}/cancelar`, { method: 'POST', token: ta });
passo('cancelamento devolve o estoque e não roda duas vezes');

const vendedorEmail = `vendedor-${sufixo}@teste.com`;
await esperar(201, '/usuarios', { method: 'POST', token: ta, body: { nome: 'Vera', email: vendedorEmail, senha: 'senha-forte-3', perfil: 'vendedor' } });
const tv = (await esperar(200, '/auth/login', { method: 'POST', body: { email: vendedorEmail, senha: 'senha-forte-3' } })).token;
const pedido = await esperar(201, '/pedidos', { method: 'POST', token: tv, body: { chave: randomUUID(), clienteId: cliente.id, itens: [item(1)], desconto: 0 } });
assert.equal(pedido.status, 'pendente');
assert.equal(pedido.vendedor_nome, 'Vera');
assert.equal(await estoque(), 3);
await esperar(403, '/vendas', { method: 'POST', token: tv, body: { itens: [item(1)], pagamentos: [{ forma: 'pix', valor: 10.5 }] } });
passo('vendedor cria pedido para cliente e reserva estoque, mas não finaliza vendas');

const caixaEmail = `caixa-${sufixo}@teste.com`;
const caixa = await esperar(201, '/usuarios', { method: 'POST', token: ta, body: { nome: 'Caio', email: caixaEmail, senha: 'senha-forte-2', perfil: 'caixa' } });
const tc = (await esperar(200, '/auth/login', { method: 'POST', body: { email: caixaEmail, senha: 'senha-forte-2' } })).token;
await esperar(403, `/pedidos/${pedido.id}/finalizar`, { method: 'POST', token: tv, body: { pagamentos: [{ forma: 'pix', valor: 10.5 }] } });
await esperar(200, `/pedidos/${pedido.id}/finalizar`, { method: 'POST', token: tc, body: { pagamentos: [{ forma: 'pix', valor: 10.5 }] } });
const vendaPedido = await esperar(200, `/vendas/${pedido.id}`, { token: tc });
assert.deepEqual([vendaPedido.status, vendaPedido.vendedor_nome, vendaPedido.usuario_nome, vendaPedido.pagamentos.length], ['concluida', 'Vera', 'Caio', 1]);
assert.equal(await estoque(), 3);
passo('caixa finaliza pedido pendente sem baixar o estoque duas vezes e a venda guarda vendedor e caixa');
const pedidoCancelado = await esperar(201, '/pedidos', { method: 'POST', token: tv, body: { chave: randomUUID(), clienteId: cliente.id, itens: [item(1)] } });
await esperar(200, `/pedidos/${pedidoCancelado.id}/cancelar`, { method: 'POST', token: tv });
assert.equal(await estoque(), 3);
passo('cancelar pedido devolve o estoque reservado');
await esperar(403, '/produtos', { method: 'POST', token: tc, body: { codigo: '9', descricao: 'x', preco: 1 } });
await esperar(403, `/vendas/${v2.id}/cancelar`, { method: 'POST', token: tc });
await esperar(403, '/usuarios', { token: tc });
await esperar(201, '/vendas', { method: 'POST', token: tc, body: { itens: [item(1)], pagamentos: [{ forma: 'dinheiro', valor: 10.5 }] } });
passo('perfil caixa vende, mas não cadastra produto, não cancela e não administra usuários');

await esperar(200, `/usuarios/${caixa.id}`, { method: 'PUT', token: ta, body: { nome: 'Caio', perfil: 'caixa', ativo: false } });
await esperar(401, '/produtos', { token: tc });
await esperar(400, `/usuarios/${A.usuario.id}`, { method: 'PUT', token: ta, body: { nome: 'Ana', perfil: 'caixa', ativo: true } });
passo('usuário desativado perde o acesso na hora; admin não rebaixa a si mesmo');

console.log('\nTudo certo.');
