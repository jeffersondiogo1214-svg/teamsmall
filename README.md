# Vendas SaaS

Sistema de vendas multiempresa: cada empresa tem seu próprio login e seus próprios dados. Inclui painel gerencial, relatórios, vendedores e pedidos, PDV, caixa, estoque, histórico de clientes e comprovante não fiscal.

**Stack:** Node.js + Express (API) · React + Vite (front) · PostgreSQL no Supabase · um único serviço no Render (o Express serve a API e o front).

## Publicar (cerca de 15 minutos)

### 1. Banco no Supabase

1. Crie um projeto em supabase.com e guarde a senha do banco.
2. Abra **SQL Editor**, cole o conteúdo de `supabase/schema.sql` e clique em **Run**.
3. Clique em **Connect** (ou Settings, Database, Connection string), escolha **Session pooler** e copie a URI. Troque `[YOUR-PASSWORD]` pela senha. Se a senha tiver caracteres especiais, codifique-os (`@` vira `%40`, `#` vira `%23`).

> Use o **Session pooler**, não a conexão direta: a direta usa IPv6 e o Render só alcança por IPv4.

Depois de atualizar um sistema já publicado, execute novamente `supabase/schema.sql` no SQL Editor para aplicar alterações compatíveis ao banco. O schema inclui perfil Vendedor, pedidos pendentes, caixa, comissão, pagamentos parciais, devoluções e histórico de estoque.

### 2. Servidor no Render

1. Envie esta pasta para um repositório no GitHub.
2. No Render: **New, Blueprint**, escolha o repositório (ele lê o `render.yaml`).
3. Preencha `DATABASE_URL` com a URI do passo anterior. O `JWT_SECRET` é gerado sozinho.
4. Aguarde o deploy, abra a URL e clique em **Quero criar a conta da minha empresa**.

Sem Blueprint: crie um único Web Service com Root Directory vazio (raiz deste projeto), Build `npm ci && npm run build`, Start `npm start`, Health check `/health` e as variáveis `DATABASE_URL`, `JWT_SECRET` e `NODE_VERSION=20`. O build compila o React em `client/dist`; sem essa etapa o servidor não inicia e informa o comando necessário.

## Rodar no computador

```bash
cp .env.example .env        # preencha DATABASE_URL e JWT_SECRET
npm install
npm run db:init             # aplica o schema (dispensável se já rodou no SQL Editor)
npm run build && npm start  # http://localhost:3000
```

Desenvolvimento com recarga automática: `npm run dev` (API) e, em outro terminal, `npm install --prefix client && npm run dev:client`, depois abra http://localhost:5173.

Teste de ponta a ponta: com o servidor rodando, `npm test`. Ele cria empresas de teste, então use um banco de teste.

## Como funciona

- **Multiempresa:** toda tabela tem `empresa_id` e toda consulta filtra por ele, vindo do login e nunca do navegador. As tabelas têm RLS ligado e sem políticas, então a API pública do Supabase não acessa nada.
- **Perfis:** Administrador (acesso total), Vendedor (monta pedidos para clientes e reserva o estoque) e Caixa (localiza pedidos no PDV, recebe pagamentos, registra devoluções e também pode fazer vendas diretas).
- **Pedido e caixa:** o vendedor fecha o pedido na tela Pedidos; o caixa seleciona o pedido no PDV e finaliza o pagamento. Cancelar um pedido pendente libera o estoque reservado. A venda registra vendedor e caixa.
- **PDV:** abra o caixa antes de vender; bipe o código de barras e tecle Enter, ou busque por nome ou código. `F2` foca a busca, `F4` o valor do pagamento e `F9` finaliza. Aceita pagamento dividido (dinheiro, PIX, débito, crédito), desconto e venda fiada associada a um cliente; troco só sobre dinheiro.
- **Venda:** preço e estoque vêm do banco. A baixa de estoque é atômica (duas vendas simultâneas não vendem a mesma última unidade), a numeração é sequencial por empresa e reenviar a mesma venda não duplica.
- **Caixa:** abertura com troco inicial, reforços, retiradas e fechamento com conferência do saldo em dinheiro.
- **Devoluções e fiado:** devolução parcial ou cancelamento total com motivo, retorno dos itens ao estoque e registro de reembolso; recebimentos posteriores de saldo aparecem no histórico do cliente.
- **Gestão:** painel com resumo diário e gráfico semanal; relatórios de vendas, vendedores/comissões, formas de pagamento e produtos podem ser exportados em CSV ou impressos/salvos como PDF.
- **Produtos e clientes:** produtos aceitam categoria, foto, estoque mínimo, entradas e ajustes com histórico. O histórico do cliente mostra compras e saldo em aberto.
- **Comprovante não fiscal:** o botão Imprimir abre a janela de impressão já formatada para bobina de 80 mm. Escolha a impressora térmica e margens "Nenhuma". Também dá para salvar em PDF.
- **Produtos e clientes** nunca são apagados, só inativados, para preservar o histórico.

## Limites conhecidos

- Não emite NFC-e nem NF-e. O comprovante é apenas um recibo.
- O cadastro de empresas é aberto a quem tiver o endereço do sistema.
- Não há recuperação de senha por e-mail: o administrador redefine a senha dos usuários em Configurações. Se o único administrador esquecer a dela, a troca é feita direto no banco.
- O token de login fica no `localStorage` do navegador e expira em 12 horas.
- Planos gratuitos: o Render hiberna o serviço sem acesso (a primeira visita depois disso demora) e o Supabase pode pausar projetos sem uso e não oferece o mesmo backup dos planos pagos. Para uso real, contrate planos pagos ou faça backup por conta própria.

## Estrutura

```
server/            API Express (auth, produtos, clientes, vendas, caixa, relatórios)
client/            front React (painel, PDV, pedidos, caixa, relatórios e cadastros)
supabase/schema.sql  tabelas, índices e RLS
test/smoke.mjs     teste de ponta a ponta da API
render.yaml        configuração do deploy
```
