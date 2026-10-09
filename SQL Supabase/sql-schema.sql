-- ============================================================================
-- BR Isolamentos — Schema Supabase (PostgreSQL), estado atual do projeto
--
-- Instalação NOVA (banco vazio): rode este arquivo inteiro no SQL Editor do
-- Supabase e pronto.
--
-- Banco JÁ criado com a versão anterior deste schema (antes de itens_orcamento,
-- impostos configuráveis, etc.): NÃO rode este arquivo de novo — rode apenas
-- sql-migration-002.sql, que aplica só as mudanças incrementais sem perder dados.
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
-- 3. materiais_isolantes — dados reais pesquisados pelo usuário
--    Fonte: 2-DocumentaçãoTecnica/materials_internal.py
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

-- ---------------------------------------------------------------------------
-- 4. acabamentos — dados reais pesquisados pelo usuário
-- ---------------------------------------------------------------------------
create table if not exists acabamentos (
  id serial primary key,
  nome varchar not null,
  emissividade double precision not null,
  ativo boolean not null default true
);

-- ---------------------------------------------------------------------------
-- 5. orcamentos (cabeçalho — dados técnicos ficam em itens_orcamento)
-- ---------------------------------------------------------------------------
create table if not exists orcamentos (
  id serial primary key,
  numero varchar not null unique,
  cliente_id int not null references clientes (id),
  data_criacao timestamptz not null default now(),
  tipo_trabalho varchar not null check (tipo_trabalho in ('quente', 'frio', 'misto')),

  -- Financeiro
  valor_materiais double precision not null default 0,
  valor_mao_obra double precision not null default 0,
  valor_deslocamento double precision not null default 0,
  valor_hospedagem double precision not null default 0,
  valor_frete double precision not null default 0,
  subtotal double precision not null default 0,
  -- lista de {nome, percentual, valor} — ver lib/orcamento.ts
  detalhamento_impostos jsonb not null default '[]',
  total_impostos double precision not null default 0,
  percentual_impostos double precision not null default 0,
  margem_lucro double precision not null default 0,
  percentual_margem double precision not null default 0,
  valor_desconto double precision not null default 0,
  preco_cheio double precision not null default 0,
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
-- 6. itens_orcamento — um "trecho" técnico por linha (suporta orçamento misto:
--    vários itens quente/frio dentro do mesmo orçamento)
-- ---------------------------------------------------------------------------
create table if not exists itens_orcamento (
  id serial primary key,
  orcamento_id int not null references orcamentos (id) on delete cascade,
  ordem int not null default 0,
  tipo_trabalho varchar not null check (tipo_trabalho in ('quente', 'frio')),

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

  espessura_necessaria_mm double precision not null,
  temperatura_face_fria double precision,
  perda_com_isolante double precision not null default 0,
  perda_sem_isolante double precision not null default 0,
  economia_anual double precision,
  co2_ton_ano double precision,

  manta_kg double precision,
  chapa_kg double precision,
  rebites int,
  parafusos int,
  arame_kg double precision,
  vedacao_pu int,
  vedacit_un int,

  valor_materiais double precision not null default 0
);

create index if not exists idx_itens_orcamento_orcamento_id on itens_orcamento (orcamento_id);

-- ---------------------------------------------------------------------------
-- 7. precos_config
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
-- 8. impostos_config — impostos extras, livremente cadastráveis
-- ---------------------------------------------------------------------------
create table if not exists impostos_config (
  id serial primary key,
  nome varchar not null,
  percentual double precision not null default 0,
  ativo boolean not null default true,
  ordem int not null default 0
);

-- ---------------------------------------------------------------------------
-- 9. config_empresa (linha única de configuração)
-- ---------------------------------------------------------------------------
create table if not exists config_empresa (
  id serial primary key,
  nome_empresa varchar not null default 'BR Isolamentos',
  email_empresa varchar,
  telefone_empresa varchar,
  cnpj varchar,

  -- Regime tributário: define o percentual de imposto "base" (ver lib/tributos.ts).
  -- Impostos extras opcionais ficam em impostos_config.
  regime_tributario varchar not null default 'simples_nacional'
    check (regime_tributario in ('simples_nacional', 'lucro_presumido', 'personalizado')),
  simples_nacional_anexo varchar not null default 'IV' check (simples_nacional_anexo in ('III', 'IV')),
  simples_nacional_rbt12 double precision not null default 0,

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

-- ---------------------------------------------------------------------------
-- 10. imagens_proposta — galeria institucional usada na Proposta Técnica
-- ---------------------------------------------------------------------------
create table if not exists imagens_proposta (
  id serial primary key,
  storage_path text not null,
  url text not null,
  legenda text,
  criado_em timestamptz not null default now()
);

insert into storage.buckets (id, name, public)
values ('propostas-imagens', 'propostas-imagens', true)
on conflict (id) do nothing;

-- ============================================================================
-- Row Level Security — acesso restrito a usuários autenticados via Supabase
-- Auth. Não há política de escrita/leitura pública nas tabelas de dados.
-- ============================================================================
alter table usuarios enable row level security;
alter table clientes enable row level security;
alter table materiais_isolantes enable row level security;
alter table acabamentos enable row level security;
alter table orcamentos enable row level security;
alter table itens_orcamento enable row level security;
alter table precos_config enable row level security;
alter table impostos_config enable row level security;
alter table config_empresa enable row level security;
alter table imagens_proposta enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'usuarios', 'clientes', 'materiais_isolantes', 'acabamentos',
    'orcamentos', 'itens_orcamento', 'precos_config', 'impostos_config',
    'config_empresa', 'imagens_proposta'
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

drop policy if exists "authenticated_insert_propostas_imagens" on storage.objects;
create policy "authenticated_insert_propostas_imagens" on storage.objects
  for insert to authenticated with check (bucket_id = 'propostas-imagens');

drop policy if exists "authenticated_delete_propostas_imagens" on storage.objects;
create policy "authenticated_delete_propostas_imagens" on storage.objects
  for delete to authenticated using (bucket_id = 'propostas-imagens');

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

-- Login único (o usuário do Supabase Auth precisa ser criado manualmente no
-- Dashboard — ver README.md).
insert into usuarios (email, nome, role) values
  ('gabryelvenzel@gmail.com', 'BR-ISOLAMENTO', 'admin')
on conflict (email) do nothing;

-- Materiais isolantes reais (fonte: materials_internal.py). Densidade extraída do
-- nome onde disponível; os marcados "-- ESTIMADO" usam valor típico de literatura.
insert into materiais_isolantes (nome, k_func, t_min, t_max, densidade_kg_m3, categoria) values
  ('Fibra Cerâmica 48kg/m³', '0.00000014 * T*T + 0.00015 * T + 0.048', 100, 800, 48, 'Fibra Cerâmica'),
  ('Fibra Cerâmica 64kg/m³', '0.00000012 * T*T + 0.00013 * T + 0.041', 100, 1000, 64, 'Fibra Cerâmica'),
  ('Fibra Cerâmica 96kg/m³', '0.00000011 * T*T + 0.00011 * T + 0.035', 100, 1260, 96, 'Fibra Cerâmica'),
  ('Fibra Cerâmica 128kg/m³', '0.00000010 * T*T + 0.00010 * T + 0.032', 100, 1400, 128, 'Fibra Cerâmica'),
  ('Lã de Rocha 32kg/m³', '0.00000021 * T*T + 0.00008 * T + 0.034', 20, 350, 32, 'Lã de Rocha'),
  ('Lã de Rocha 48kg/m³', '0.00000019 * T*T + 0.00007 * T + 0.033', 20, 450, 48, 'Lã de Rocha'),
  ('Lã de Rocha 64kg/m³', '0.00000017 * T*T + 0.00007 * T + 0.032', 20, 650, 64, 'Lã de Rocha'),
  ('Manta de Fibra de Vidro (Uso Industrial) 48kg/m³', '0.00000018 * T*T + 0.00009 * T + 0.036', 20, 540, 48, 'Fibra de Vidro'),
  ('Manta de fibra de vidro 130kg/m³ até 800°C', '0.0286 * Math.exp(0.0029 * T)', 25, 800, 130, 'Fibra de Vidro'),
  ('Aerogel - Pyrogel XTE (Industrial)', '0.021 + 0.0001 * T', -40, 650, 160, 'Aerogel'), -- ESTIMADO (densidade)
  ('Aerogel - Cryogel Z (Criogênico)', '0.014 + 0.00006 * T', -200, 125, 160, 'Aerogel'), -- ESTIMADO (densidade)
  ('Concreto Refratário Denso (1800kg/m³)', '1.1', 100, 1400, 1800, 'Refratário'),
  ('Concreto Refratário Isolante (800kg/m³)', '0.0002 * T + 0.18', 100, 1100, 800, 'Refratário'),
  ('Silicato de Cálcio 240kg/m³', '0.00015 * T + 0.05', 100, 650, 240, 'Outros Isolantes'),
  ('Espuma Elastomérica 50kg/m³', '0.0000001 * T*T + 0.00008 * T + 0.034', -50, 110, 50, 'Outros Isolantes'),
  ('Espuma Rígida de Poliisocianurato (PIR) 35kg/m³', '0.0001 * T + 0.023', -180, 150, 35, 'Outros Isolantes'),
  ('Vidro Celular (Foamglas) 120kg/m³', '0.00017 * T + 0.041', -268, 430, 120, 'Outros Isolantes'),
  ('Perlita Expandida (Granular)', '0.00011 * T + 0.045', -200, 800, 100, 'Granular/Cimentício'), -- ESTIMADO (densidade)
  ('Vermiculita Exfoliada (Granular)', '0.00015 * T + 0.062', 50, 1100, 100, 'Granular/Cimentício'), -- ESTIMADO (densidade)
  ('Espuma Rígida de Poliuretano (PUR) 35kg/m³', '0.00000005 * T*T + 0.00008 * T + 0.025', -180, 110, 35, 'Plásticos e Polímeros'),
  ('Poliestireno Extrudado (XPS) 30kg/m³', '0.0001 * T + 0.029', -50, 75, 30, 'Plásticos e Polímeros'),
  ('Poliestireno Expandido (EPS) 20kg/m³', '0.00011 * T + 0.034', -50, 80, 20, 'Plásticos e Polímeros')
on conflict do nothing;

insert into acabamentos (nome, emissividade) values
  ('Jaqueta Térmica Removível (Tecido)', 0.90),
  ('Alumínio Polido (Novo)', 0.05),
  ('Alumínio Rústico/Fosco', 0.07),
  ('Alumínio Oxidado/Intemperizado', 0.25),
  ('Aço Inox Polido (Novo)', 0.08),
  ('Aço Inox Intemperizado', 0.85),
  ('Aço Galvanizado (Novo)', 0.23),
  ('Aço Galvanizado Oxidado', 0.28),
  ('Superfície Pintada (Tinta Esmalte Branca)', 0.87),
  ('Superfície Pintada (Tinta Esmalte Preta Fosca)', 0.97),
  ('Superfície Pintada (Tinta Alumínio)', 0.31)
on conflict do nothing;
