-- ============================================================================
-- BR Isolamentos — Migração 002
-- Rode DEPOIS de já ter aplicado sql-schema.sql. Aditivo/idempotente onde possível
-- (usa IF NOT EXISTS / ON CONFLICT), mas os DELETE+INSERT de materiais/acabamentos
-- substituem os dados placeholder pelos dados reais pesquisados pelo usuário — só
-- afeta essas duas tabelas de referência, não toca em `orcamentos`/`clientes`.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Materiais isolantes e acabamentos reais
--    Fonte: 2-DocumentaçãoTecnica/materials_internal.py (mais completo e recente).
--    Densidade extraída do nome do material onde disponível; os 4 marcados
--    "-- ESTIMADO" não tinham densidade na fonte e usam valor típico de literatura.
-- ----------------------------------------------------------------------------
delete from materiais_isolantes;
delete from acabamentos;

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
  ('Poliestireno Expandido (EPS) 20kg/m³', '0.00011 * T + 0.034', -50, 80, 20, 'Plásticos e Polímeros');

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
  ('Superfície Pintada (Tinta Alumínio)', 0.31);

-- ----------------------------------------------------------------------------
-- 2. Impostos configuráveis + regime tributário
-- ----------------------------------------------------------------------------
create table if not exists impostos_config (
  id serial primary key,
  nome varchar not null,
  percentual double precision not null default 0,
  ativo boolean not null default true,
  ordem int not null default 0
);

alter table impostos_config enable row level security;
drop policy if exists "authenticated_all_impostos_config" on impostos_config;
create policy "authenticated_all_impostos_config" on impostos_config
  for all to authenticated using (true) with check (true);

alter table config_empresa add column if not exists regime_tributario varchar not null default 'simples_nacional'
  check (regime_tributario in ('simples_nacional', 'lucro_presumido', 'personalizado'));
alter table config_empresa add column if not exists simples_nacional_anexo varchar not null default 'IV'
  check (simples_nacional_anexo in ('III', 'IV'));
alter table config_empresa add column if not exists simples_nacional_rbt12 double precision not null default 0;

alter table config_empresa drop column if exists aliquota_iss_percentual;
alter table config_empresa drop column if exists aliquota_inss_percentual;

-- ----------------------------------------------------------------------------
-- 3. Orçamento com múltiplos itens (suporte a "misto")
-- ----------------------------------------------------------------------------
alter table orcamentos drop constraint if exists orcamentos_tipo_trabalho_check;
alter table orcamentos add constraint orcamentos_tipo_trabalho_check
  check (tipo_trabalho in ('quente', 'frio', 'misto'));

-- Colunas técnicas antigas de orcamentos migram para itens_orcamento — deixamos de
-- exigir NOT NULL nelas (não removemos, para não perder dados de teste existentes).
alter table orcamentos alter column material drop not null;
alter table orcamentos alter column temperatura_quente drop not null;
alter table orcamentos alter column temperatura_ambiente drop not null;
alter table orcamentos alter column geometria drop not null;
alter table orcamentos alter column area_m2 drop not null;
alter table orcamentos alter column espessura_necessaria_mm drop not null;

alter table orcamentos add column if not exists detalhamento_impostos jsonb not null default '[]';
alter table orcamentos add column if not exists percentual_impostos double precision not null default 0;
alter table orcamentos add column if not exists percentual_margem double precision not null default 0;
alter table orcamentos add column if not exists preco_cheio double precision not null default 0;
alter table orcamentos drop column if exists valor_iss;
alter table orcamentos drop column if exists valor_inss;

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

alter table itens_orcamento enable row level security;
drop policy if exists "authenticated_all_itens_orcamento" on itens_orcamento;
create policy "authenticated_all_itens_orcamento" on itens_orcamento
  for all to authenticated using (true) with check (true);

-- ----------------------------------------------------------------------------
-- 4. Galeria de imagens para a Proposta Técnica (Supabase Storage)
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('propostas-imagens', 'propostas-imagens', true)
on conflict (id) do nothing;

drop policy if exists "authenticated_insert_propostas_imagens" on storage.objects;
create policy "authenticated_insert_propostas_imagens" on storage.objects
  for insert to authenticated with check (bucket_id = 'propostas-imagens');

drop policy if exists "authenticated_delete_propostas_imagens" on storage.objects;
create policy "authenticated_delete_propostas_imagens" on storage.objects
  for delete to authenticated using (bucket_id = 'propostas-imagens');

create table if not exists imagens_proposta (
  id serial primary key,
  storage_path text not null,
  url text not null,
  legenda text,
  criado_em timestamptz not null default now()
);

alter table imagens_proposta enable row level security;
drop policy if exists "authenticated_all_imagens_proposta" on imagens_proposta;
create policy "authenticated_all_imagens_proposta" on imagens_proposta
  for all to authenticated using (true) with check (true);

-- ----------------------------------------------------------------------------
-- 5. Login único "BR-ISOLAMENTO"
--    Continua exigindo criação manual do usuário em Supabase Dashboard →
--    Authentication → Users (email gabryelvenzel@gmail.com, senha BR-ISO-2026) —
--    não é possível criar usuários de Auth via SQL/anon key.
-- ----------------------------------------------------------------------------
insert into usuarios (email, nome, role)
values ('gabryelvenzel@gmail.com', 'BR-ISOLAMENTO', 'admin')
on conflict (email) do update set nome = excluded.nome, role = excluded.role;
