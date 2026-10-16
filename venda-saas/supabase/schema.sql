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
  documento  text not null,
  telefone   numeric(20,0),
  email      text,
  endereco   text,
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now()
);
create index if not exists clientes_empresa_nome_idx on clientes (empresa_id, nome);

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
update vendas set finalizada_em = criado_em where status = 'concluida' and finalizada_em is null;

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

-- Segurança: o app acessa o banco só pelo servidor Node (usuário postgres, que ignora RLS).
-- Com RLS ligado e sem políticas, a API pública do Supabase (chave anon) não lê nem grava nada.
alter table empresas          enable row level security;
alter table usuarios          enable row level security;
alter table clientes          enable row level security;
alter table produtos          enable row level security;
alter table vendas            enable row level security;
alter table venda_itens       enable row level security;
alter table venda_pagamentos  enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on all tables in schema public from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on all tables in schema public from authenticated;
  end if;
end $$;
