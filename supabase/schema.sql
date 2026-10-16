-- Vendas SaaS: schema multiempresa para Supabase (PostgreSQL).
-- Pode ser executado mais de uma vez sem erro.
-- Toda tabela de negócio carrega empresa_id: é ele que separa uma empresa da outra.

create table if not exists empresas (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null,
  documento      text,
  telefone       text,
  endereco       text,
  proximo_numero integer not null default 1,   -- numeração sequencial das vendas por empresa
  criado_em      timestamptz not null default now()
);

create table if not exists usuarios (
  id         uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  nome       text not null,
  email      text not null,
  senha_hash text not null,
  perfil     text not null check (perfil in ('admin', 'caixa', 'vendedor')),
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now()
);
create unique index if not exists usuarios_email_uq on usuarios (lower(email));
create index if not exists usuarios_empresa_idx on usuarios (empresa_id);

create table if not exists clientes (
  id         uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  nome       text not null,
  documento  text,
  telefone   text,
  email      text,
  endereco   text,
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now()
);
create index if not exists clientes_empresa_nome_idx on clientes (empresa_id, nome);
alter table clientes alter column documento drop not null;
alter table clientes alter column telefone type text using telefone::text;

create table if not exists produtos (
  id               uuid primary key default gen_random_uuid(),
  empresa_id       uuid not null references empresas(id) on delete cascade,
  codigo           text not null,
  barras           text,
  descricao        text not null,
  unidade          text not null default 'UN',
  preco            numeric(12,2) not null check (preco >= 0),
  estoque          numeric(12,3) not null default 0 check (estoque >= 0),
  controla_estoque boolean not null default true,
  ativo            boolean not null default true,
  criado_em        timestamptz not null default now(),
  unique (empresa_id, codigo)
);
create index if not exists produtos_empresa_descricao_idx on produtos (empresa_id, descricao);
create index if not exists produtos_empresa_barras_idx on produtos (empresa_id, barras) where barras is not null;

create table if not exists vendas (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references empresas(id) on delete cascade,
  numero       integer not null,
  chave        uuid,                                   -- evita venda duplicada se o envio for repetido
  cliente_id   uuid references clientes(id) on delete set null,
  cliente_nome text,
  usuario_id   uuid references usuarios(id) on delete set null,
  usuario_nome text,
  subtotal     numeric(12,2) not null check (subtotal >= 0),
  desconto     numeric(12,2) not null default 0 check (desconto >= 0),
  total        numeric(12,2) not null check (total >= 0),
  troco        numeric(12,2) not null default 0 check (troco >= 0),
  status       text not null default 'concluida' check (status in ('pendente', 'concluida', 'cancelada')),
  observacao   text,
  criado_em    timestamptz not null default now(),
  finalizada_em timestamptz,
  cancelada_em timestamptz,
  vendedor_id  uuid references usuarios(id) on delete set null,
  vendedor_nome text,
  unique (empresa_id, numero),
  unique (empresa_id, chave)
);
create index if not exists vendas_empresa_data_idx on vendas (empresa_id, criado_em desc);

alter table usuarios drop constraint if exists usuarios_perfil_check;
alter table usuarios add constraint usuarios_perfil_check check (perfil in ('admin', 'caixa', 'vendedor'));

alter table vendas add column if not exists finalizada_em timestamptz;
alter table vendas add column if not exists vendedor_id uuid references usuarios(id) on delete set null;
alter table vendas add column if not exists vendedor_nome text;
alter table vendas drop constraint if exists vendas_status_check;
alter table vendas add constraint vendas_status_check check (status in ('pendente', 'concluida', 'cancelada'));
update vendas set finalizada_em = criado_em where status <> 'pendente' and finalizada_em is null;

create table if not exists venda_itens (
  id         uuid primary key default gen_random_uuid(),
  venda_id   uuid not null references vendas(id) on delete cascade,
  empresa_id uuid not null references empresas(id) on delete cascade,
  item       integer not null,
  produto_id uuid references produtos(id) on delete set null,
  codigo     text,
  descricao  text not null,
  unidade    text,
  quantidade numeric(12,3) not null check (quantidade > 0),
  preco_unit numeric(12,2) not null,
  total      numeric(12,2) not null,
  estoque_reservado boolean not null default false
);
do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = current_schema()
       and table_name = 'venda_itens'
       and column_name = 'estoque_reservado'
  ) then
    alter table venda_itens add column estoque_reservado boolean not null default false;
    update venda_itens i
       set estoque_reservado = p.controla_estoque
      from produtos p
     where i.produto_id = p.id;
  end if;
end $$;
create index if not exists venda_itens_venda_idx on venda_itens (venda_id, item);

create table if not exists venda_pagamentos (
  id         uuid primary key default gen_random_uuid(),
  venda_id   uuid not null references vendas(id) on delete cascade,
  empresa_id uuid not null references empresas(id) on delete cascade,
  ordem      integer not null,
  forma      text not null check (forma in ('dinheiro', 'pix', 'debito', 'credito')),
  valor      numeric(12,2) not null check (valor > 0)
);
create index if not exists venda_pagamentos_venda_idx on venda_pagamentos (venda_id, ordem);

alter table empresas add column if not exists comissao_percentual numeric(5,2) not null default 0
  check (comissao_percentual between 0 and 100);
alter table usuarios add column if not exists comissao_percentual numeric(5,2)
  check (comissao_percentual is null or comissao_percentual between 0 and 100);
alter table produtos add column if not exists estoque_minimo numeric(12,3) not null default 0 check (estoque_minimo >= 0);
alter table produtos add column if not exists categoria text;
alter table produtos add column if not exists imagem_url text;
alter table vendas add column if not exists motivo_cancelamento text;
alter table vendas add column if not exists comissao_percentual numeric(5,2)
  check (comissao_percentual is null or comissao_percentual between 0 and 100);
alter table venda_itens add column if not exists quantidade_devolvida numeric(12,3) not null default 0
  check (quantidade_devolvida >= 0 and quantidade_devolvida <= quantidade);
alter table venda_pagamentos add column if not exists origem text not null default 'venda'
  check (origem in ('venda', 'cobranca'));
alter table venda_pagamentos add column if not exists criado_em timestamptz not null default now();
alter table venda_pagamentos add column if not exists caixa_id uuid;

create table if not exists caixas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  usuario_id uuid not null references usuarios(id),
  aberto_em timestamptz not null default now(),
  valor_abertura numeric(12,2) not null check (valor_abertura >= 0),
  fechado_em timestamptz,
  valor_esperado numeric(12,2),
  valor_contado numeric(12,2),
  diferenca numeric(12,2),
  unique (id, empresa_id)
);
create unique index if not exists caixas_empresa_usuario_aberto_uq on caixas (empresa_id, usuario_id) where fechado_em is null;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'venda_pagamentos_caixa_fk') then
    alter table venda_pagamentos add constraint venda_pagamentos_caixa_fk
      foreign key (caixa_id) references caixas(id) on delete set null;
  end if;
end $$;

create table if not exists caixa_movimentos (
  id uuid primary key default gen_random_uuid(),
  caixa_id uuid not null references caixas(id),
  empresa_id uuid not null references empresas(id) on delete cascade,
  usuario_id uuid references usuarios(id) on delete set null,
  tipo text not null check (tipo in ('abertura', 'reforco', 'retirada', 'venda', 'cobranca', 'devolucao')),
  valor numeric(12,2) not null check (valor > 0),
  descricao text,
  criado_em timestamptz not null default now()
);
create index if not exists caixa_movimentos_caixa_idx on caixa_movimentos (caixa_id, criado_em);

create table if not exists venda_devolucoes (
  id uuid primary key default gen_random_uuid(),
  venda_id uuid not null references vendas(id),
  empresa_id uuid not null references empresas(id) on delete cascade,
  usuario_id uuid references usuarios(id) on delete set null,
  caixa_id uuid references caixas(id) on delete set null,
  motivo text not null,
  valor numeric(12,2) not null check (valor > 0),
  valor_reembolsado numeric(12,2) not null default 0 check (valor_reembolsado >= 0),
  forma_reembolso text check (forma_reembolso is null or forma_reembolso in ('dinheiro', 'pix', 'debito', 'credito')),
  criado_em timestamptz not null default now()
);
create index if not exists venda_devolucoes_venda_idx on venda_devolucoes (venda_id, criado_em);

create table if not exists venda_devolucao_itens (
  id uuid primary key default gen_random_uuid(),
  devolucao_id uuid not null references venda_devolucoes(id) on delete cascade,
  venda_item_id uuid not null references venda_itens(id),
  quantidade numeric(12,3) not null check (quantidade > 0),
  valor numeric(12,2) not null check (valor > 0)
);

create table if not exists estoque_movimentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  produto_id uuid references produtos(id) on delete set null,
  produto_descricao text not null,
  usuario_id uuid references usuarios(id) on delete set null,
  venda_id uuid references vendas(id) on delete set null,
  tipo text not null check (tipo in ('entrada', 'ajuste', 'venda', 'reserva_pedido', 'liberacao_pedido', 'cancelamento', 'devolucao')),
  variacao numeric(12,3) not null check (variacao <> 0),
  estoque_apos numeric(12,3) not null check (estoque_apos >= 0),
  motivo text,
  criado_em timestamptz not null default now()
);
alter table estoque_movimentos drop constraint if exists estoque_movimentos_tipo_check;
alter table estoque_movimentos add constraint estoque_movimentos_tipo_check
  check (tipo in ('entrada', 'ajuste', 'venda', 'reserva_pedido', 'liberacao_pedido', 'cancelamento', 'devolucao'));
create index if not exists estoque_movimentos_produto_idx on estoque_movimentos (produto_id, criado_em desc);

-- Segurança: o app acessa o banco só pelo servidor Node (usuário postgres, que ignora RLS).
-- Com RLS ligado e sem políticas, a API pública do Supabase (chave anon) não lê nem grava nada.
alter table empresas          enable row level security;
alter table usuarios          enable row level security;
alter table clientes          enable row level security;
alter table produtos          enable row level security;
alter table vendas            enable row level security;
alter table venda_itens       enable row level security;
alter table venda_pagamentos  enable row level security;
alter table caixa_movimentos enable row level security;
alter table venda_devolucoes enable row level security;
alter table venda_devolucao_itens enable row level security;
alter table estoque_movimentos enable row level security;
alter table caixas enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on all tables in schema public from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on all tables in schema public from authenticated;
  end if;
end $$;
