-- ============================================================================
-- BR Isolamentos — Schema Supabase (PostgreSQL)
-- Rode este arquivo inteiro no SQL Editor do Supabase (Dashboard > SQL Editor
-- > New query > colar > Run). Veja CHECKLIST_EXECUCAO.md para o passo a passo.
--
-- Inclui duas tabelas além do escopo original do prompt inicial:
--   materiais_isolantes / acabamentos
-- necessárias porque o motor de cálculo térmico usado (porte fiel de
-- CALCULADORA-TERMICA.py) precisa de k(T) por material e emissividade por
-- acabamento — dados que na ferramenta Python vinham de uma planilha Google
-- Sheets externa. Os valores semeados abaixo são placeholders de literatura
-- técnica (ASTM/ASHRAE) e ESTÃO MARCADOS para validação manual.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. usuarios (perfil complementar ao Supabase Auth)
-- ---------------------------------------------------------------------------
create table if not exists usuarios (
  id uuid primary key default gen_random_uuid(),
  email varchar not null unique,
  nome varchar not null,
  role varchar not null default 'consultor' check (role in ('admin', 'consultor')),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. clientes
-- ---------------------------------------------------------------------------
create table if not exists clientes (
  id serial primary key,
  nome varchar not null,
  email varchar,
  telefone varchar,
  endereco text,
  cnpj_cpf varchar,
  criado_em timestamptz not null default now(),
  criado_por varchar references usuarios (email)
);

-- ---------------------------------------------------------------------------
-- 3. materiais_isolantes (novo — necessário para o motor térmico real)
-- ---------------------------------------------------------------------------
create table if not exists materiais_isolantes (
  id serial primary key,
  nome varchar not null,
  -- fórmula de k(T) em função de T (°C médio da camada), ex: "0.031 + 0.00019*T"
  k_func varchar not null,
  t_min double precision not null,
  t_max double precision not null,
  densidade_kg_m3 double precision not null,
  categoria varchar,
  ativo boolean not null default true
);

comment on table materiais_isolantes is
  'PLACEHOLDER: dados semeados de literatura técnica (ASTM/ASHRAE). Substituir pelos valores reais da planilha Google Sheets "Isolantes 2" usada por CALCULADORA-TERMICA.py.';

-- ---------------------------------------------------------------------------
-- 4. acabamentos (novo — necessário para o motor térmico real)
-- ---------------------------------------------------------------------------
create table if not exists acabamentos (
  id serial primary key,
  nome varchar not null,
  emissividade double precision not null,
  ativo boolean not null default true
);

comment on table acabamentos is
  'PLACEHOLDER: dados semeados de literatura técnica. Substituir pelos valores reais da planilha Google Sheets "Emissividade" usada por CALCULADORA-TERMICA.py.';

-- ---------------------------------------------------------------------------
-- 5. orcamentos
-- ---------------------------------------------------------------------------
create table if not exists orcamentos (
  id serial primary key,
  numero varchar not null unique,
  cliente_id int not null references clientes (id),
  data_criacao timestamptz not null default now(),
  tipo_trabalho varchar not null check (tipo_trabalho in ('quente', 'frio')),

  -- Especificações técnicas
  material varchar not null,
  acabamento varchar,
  temperatura_quente double precision not null,
  temperatura_ambiente double precision not null,
  umidade_relativa double precision,
  velocidade_vento double precision,
  geometria varchar not null check (geometria in ('plana', 'tubulacao')),
  diametro_mm double precision,
  area_m2 double precision not null,
  perimetro_m double precision,

  -- Resultados dos cálculos
  espessura_necessaria_mm double precision not null,
  temperatura_face_fria double precision,
  perda_com_isolante double precision not null default 0,
  perda_sem_isolante double precision not null default 0,
  economia_anual double precision,
  co2_ton_ano double precision,

  -- Quantificação
  manta_kg double precision,
  chapa_kg double precision,
  rebites int,
  parafusos int,
  arame_kg double precision,
  vedacao_pu int,
  vedacit_un int,

  -- Financeiro
  valor_materiais double precision not null default 0,
  valor_mao_obra double precision not null default 0,
  valor_deslocamento double precision not null default 0,
  valor_hospedagem double precision not null default 0,
  valor_frete double precision not null default 0,
  subtotal double precision not null default 0,
  valor_iss double precision not null default 0,
  valor_inss double precision not null default 0,
  total_impostos double precision not null default 0,
  margem_lucro double precision not null default 0,
  valor_desconto double precision not null default 0,
  valor_final double precision not null default 0,

  -- Status
  status varchar not null default 'rascunho'
    check (status in ('rascunho', 'proposta', 'enviado', 'aceito', 'rejeitado')),
  proposta_pdf_url text,
  criado_por varchar references usuarios (email),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_orcamentos_cliente_id on orcamentos (cliente_id);
create index if not exists idx_orcamentos_status on orcamentos (status);
create index if not exists idx_orcamentos_data_criacao on orcamentos (data_criacao);

create or replace function set_atualizado_em()
returns trigger as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_orcamentos_atualizado_em on orcamentos;
create trigger trg_orcamentos_atualizado_em
  before update on orcamentos
  for each row execute function set_atualizado_em();

-- ---------------------------------------------------------------------------
-- 6. precos_config
-- ---------------------------------------------------------------------------
create table if not exists precos_config (
  id serial primary key,
  tipo_material varchar not null
    check (tipo_material in ('manta', 'chapa', 'arame', 'rebite', 'parafuso', 'vedacao', 'vedacit')),
  descricao varchar not null,
  preco_unitario double precision not null default 0,
  densidade_kg_m3 double precision,
  ativo boolean not null default true,
  ultima_atualizacao timestamptz not null default now()
);

drop trigger if exists trg_precos_config_atualizado_em on precos_config;
create trigger trg_precos_config_atualizado_em
  before update on precos_config
  for each row execute function set_atualizado_em();

-- ---------------------------------------------------------------------------
-- 7. config_empresa (linha única de configuração)
-- ---------------------------------------------------------------------------
create table if not exists config_empresa (
  id serial primary key,
  nome_empresa varchar not null default 'BR Isolamentos',
  email_empresa varchar,
  telefone_empresa varchar,
  cnpj varchar,

  aliquota_iss_percentual double precision not null default 5,
  aliquota_inss_percentual double precision not null default 11,
  margem_lucro_padrao double precision not null default 30,
  desconto_competitivo double precision not null default 0,

  valor_hora_mao_obra double precision not null default 0,
  valor_km_deslocamento double precision not null default 0,
  valor_noite_hospedagem double precision not null default 0,
  valor_frete_por_tonelada double precision not null default 0,

  -- Assunção documentada (ver lib/quantificador.ts): gramas de Vedacit
  -- consumidos por junta de vedação P.U. Sem referência exata nas planilhas
  -- originais — validar com a operação real antes de confiar no valor.
  vedacit_gramas_por_junta double precision not null default 50
);

-- ============================================================================
-- Row Level Security — acesso restrito aos 3 sócios autenticados via
-- Supabase Auth. Não há política de escrita/leitura pública.
-- ============================================================================
alter table usuarios enable row level security;
alter table clientes enable row level security;
alter table materiais_isolantes enable row level security;
alter table acabamentos enable row level security;
alter table orcamentos enable row level security;
alter table precos_config enable row level security;
alter table config_empresa enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'usuarios', 'clientes', 'materiais_isolantes', 'acabamentos',
    'orcamentos', 'precos_config', 'config_empresa'
  ]
  loop
    execute format(
      'drop policy if exists "authenticated_all_%1$s" on %1$s;
       create policy "authenticated_all_%1$s" on %1$s
         for all
         to authenticated
         using (true)
         with check (true);',
      t
    );
  end loop;
end $$;

-- ============================================================================
-- Seed de configuração inicial
-- ============================================================================
insert into config_empresa (nome_empresa)
select 'BR Isolamentos'
where not exists (select 1 from config_empresa);

insert into precos_config (tipo_material, descricao, preco_unitario, densidade_kg_m3) values
  ('manta', 'Manta isolante (padrão)', 0, 100),
  ('chapa', 'Chapa de acabamento 0,8mm x 1000mm', 0, 7850),
  ('rebite', 'Rebite de fixação', 0, null),
  ('parafuso', 'Parafuso autobrocante', 0, null),
  ('arame', 'Arame de amarração (por kg)', 0, null),
  ('vedacao', 'Vedação P.U.', 0, null),
  ('vedacit', 'Vedacit (lata 360g)', 45, null)
on conflict do nothing;

-- PLACEHOLDER — validar com a planilha Google Sheets "Isolantes 2" real.
insert into materiais_isolantes (nome, k_func, t_min, t_max, densidade_kg_m3, categoria) values
  ('Lã de Rocha', '0.031 + 0.00019*T', -50, 700, 100, 'quente'),
  ('Lã de Vidro', '0.032 + 0.00015*T', -20, 350, 24, 'quente'),
  ('Silicato de Cálcio', '0.055 + 0.00013*T', 0, 650, 240, 'quente'),
  ('Poliuretano (PUR) rígido', '0.023 + 0.00007*T', -180, 110, 40, 'frio'),
  ('Elastomérico Flexível', '0.036 + 0.00009*T', -50, 105, 65, 'frio')
on conflict do nothing;

-- PLACEHOLDER — validar com a planilha Google Sheets "Emissividade" real.
insert into acabamentos (nome, emissividade) values
  ('Alumínio corrugado novo', 0.10),
  ('Alumínio oxidado', 0.30),
  ('Aço inox', 0.25),
  ('Chapa galvanizada', 0.28),
  ('Tinta preta fosca', 0.95)
on conflict do nothing;
