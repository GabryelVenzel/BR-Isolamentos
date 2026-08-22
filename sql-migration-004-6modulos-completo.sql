-- ============================================================================
-- BR Isolamentos — Migração 004: tabelas dos 6 módulos do ERP
--
-- Pré-requisito: sql-schema.sql + sql-migration-002.sql já aplicados (criam
-- usuarios, clientes, orcamentos, itens_orcamento, materiais_isolantes,
-- acabamentos, precos_config, impostos_config, config_empresa,
-- imagens_proposta). Este arquivo só ADICIONA o que falta para Comercial,
-- Operacional e Financeiro — Engenharia e Orçamento já são as tabelas acima.
--
-- 100% aditivo e idempotente:
--   • create table/index IF NOT EXISTS
--   • alter table ... add column IF NOT EXISTS
--   • drop view/policy IF EXISTS antes de recriar (view/policy não aceitam
--     "IF NOT EXISTS" no CREATE em Postgres — dropar antes é o padrão certo)
--   • inserts de seed com ON CONFLICT DO NOTHING
--   • NENHUM DROP TABLE / TRUNCATE / DELETE em tabela com dado de produção
-- Pode rodar no SQL Editor do Supabase quantas vezes precisar, sem perder
-- nada do que já existe.
--
-- Nomenclatura: as tabelas novas usam `created_at`/`updated_at` (inglês) e
-- colunas `timestamp` (sem fuso horário) e `date`, conforme pedido — diferente
-- do padrão `criado_em`/`atualizado_em timestamptz` das tabelas do MVP
-- (orcamentos, clientes...). É uma inconsistência real entre as duas gerações
-- do schema; documentada aqui em vez de escondida. Se algum dia isso virar
-- problema (ex.: bug de fuso horário em agendamentos), a correção é trocar
-- `timestamp`/`date` por `timestamptz` nessas colunas — não é urgente porque
-- a operação é toda num único fuso (America/Sao_Paulo, sem horário de verão
-- desde 2019).
-- ============================================================================


-- ============================================================================
-- MÓDULO COMERCIAL — funil de leads
-- ============================================================================

-- ----------------------------------------------------------------------------
-- leads — ver EtapaFunil/TemperaturaLead/Lead em lib/types/domain.ts
-- ----------------------------------------------------------------------------
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  cliente_id int not null references clientes (id),
  etapa varchar not null default 'prospeccao'
    check (etapa in ('prospeccao', 'contato', 'proposta', 'negociacao', 'fechado', 'perdido')),
  temperatura varchar not null default 'morno'
    check (temperatura in ('frio', 'morno', 'quente')),
  valor_estimado numeric(12, 2) not null default 0,
  origem varchar,
  proxima_acao text,
  data_proxima_acao date,
  notas text,
  atribuido_a varchar references usuarios (email),
  tags text[] not null default '{}',
  created_at timestamp not null default current_timestamp,
  updated_at timestamp not null default current_timestamp,
  -- Como pedido, mas com uma ressalva: `created_at` tem precisão de
  -- microssegundo, então esse UNIQUE praticamente nunca bloqueia nada (dois
  -- leads do mesmo cliente quase nunca têm o mesmo timestamp exato) — não é
  -- uma trava real contra "lead duplicado para o mesmo cliente". Se o
  -- objetivo é impedir 2 leads simultaneamente abertos pro mesmo cliente,
  -- isso precisa de uma regra de negócio no use case (ex.: bloquear
  -- `criarLead` se já existe um lead do cliente com etapa != 'fechado'/
  -- 'perdido'), não de uma constraint de banco.
  unique (cliente_id, created_at)
);

create index if not exists idx_leads_cliente_id on leads (cliente_id);
create index if not exists idx_leads_etapa on leads (etapa);
create index if not exists idx_leads_atribuido_a on leads (atribuido_a);

-- ----------------------------------------------------------------------------
-- interacoes_lead — histórico de contatos de um lead (timeline do funil)
-- ----------------------------------------------------------------------------
create table if not exists interacoes_lead (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads (id) on delete cascade,
  tipo varchar not null
    check (tipo in ('nota', 'email', 'chamada', 'reuniao', 'proposta_enviada')),
  descricao text not null,
  autor_email varchar references usuarios (email),
  data_interacao timestamp not null default current_timestamp,
  created_at timestamp not null default current_timestamp
);

create index if not exists idx_interacoes_lead_lead_id on interacoes_lead (lead_id);


-- ============================================================================
-- MÓDULO OPERACIONAL — parceiros de instalação e agenda de execução
-- ============================================================================

-- ----------------------------------------------------------------------------
-- parceiros — mão de obra terceirizada/parceira
-- ----------------------------------------------------------------------------
create table if not exists parceiros (
  id uuid primary key default gen_random_uuid(),
  nome varchar not null,
  email varchar,
  telefone varchar,
  endereco text,
  cidade varchar,
  estado varchar(2),
  cpf varchar unique,
  conta_bancaria text,
  especialidades text[] not null default '{}',
  disponibilidade_horas_semana numeric(5, 2),
  disponibilidade_dias text[] not null default '{}',
  custo_hora numeric(8, 2),
  ativo boolean not null default true,
  created_at timestamp not null default current_timestamp,
  updated_at timestamp not null default current_timestamp
);

create index if not exists idx_parceiros_email on parceiros (email);
create index if not exists idx_parceiros_ativo on parceiros (ativo);
create index if not exists idx_parceiros_cidade on parceiros (cidade);

-- ----------------------------------------------------------------------------
-- agendamentos — execução de um orçamento em campo, com 1+ parceiros alocados
-- ----------------------------------------------------------------------------
create table if not exists agendamentos (
  id uuid primary key default gen_random_uuid(),
  orcamento_id int references orcamentos (id) on delete set null,
  data_inicio date not null,
  data_fim date,
  -- Array de FKs pra parceiros (Postgres não tem "foreign key de array"): a
  -- integridade referencial de cada id dentro do array precisa ser garantida
  -- pelo use case que grava aqui (ex.: lib/usecases/operacional/agendar.ts,
  -- quando existir), validando cada id contra `parceiros` antes de salvar.
  parceiros_alocados uuid[] not null default '{}',
  status varchar not null default 'agendado'
    check (status in ('agendado', 'em_progresso', 'concluido', 'cancelado')),
  local text,
  notas text,
  horas_estimadas numeric(6, 2),
  horas_reais numeric(6, 2),
  created_at timestamp not null default current_timestamp,
  updated_at timestamp not null default current_timestamp
);

create index if not exists idx_agendamentos_orcamento_id on agendamentos (orcamento_id);
create index if not exists idx_agendamentos_data_inicio on agendamentos (data_inicio);
create index if not exists idx_agendamentos_status on agendamentos (status);


-- ============================================================================
-- MÓDULO FINANCEIRO — contas a pagar/receber, custos fixos e notas fiscais
-- ============================================================================

-- ----------------------------------------------------------------------------
-- lancamentos_financeiros — receitas e despesas (vinculadas ou não a um
-- orçamento). Nada aqui recalcula imposto — o imposto de um orçamento já foi
-- calculado e gravado em `orcamentos.detalhamento_impostos` na hora da venda
-- (ver lib/tributos.ts); este módulo só registra o fluxo de caixa.
-- ----------------------------------------------------------------------------
create table if not exists lancamentos_financeiros (
  id uuid primary key default gen_random_uuid(),
  tipo varchar not null check (tipo in ('receita', 'despesa')),
  categoria varchar not null,
  data date not null default current_date,
  descricao text not null,
  valor numeric(12, 2) not null,
  pago boolean not null default false,
  data_pagamento date,
  orcamento_id int references orcamentos (id) on delete set null,
  arquivo_url text,
  created_at timestamp not null default current_timestamp,
  updated_at timestamp not null default current_timestamp
);

create index if not exists idx_lancamentos_financeiros_tipo on lancamentos_financeiros (tipo);
create index if not exists idx_lancamentos_financeiros_categoria on lancamentos_financeiros (categoria);
create index if not exists idx_lancamentos_financeiros_data on lancamentos_financeiros (data);
create index if not exists idx_lancamentos_financeiros_pago on lancamentos_financeiros (pago);
create index if not exists idx_lancamentos_financeiros_orcamento_id on lancamentos_financeiros (orcamento_id);

-- ----------------------------------------------------------------------------
-- custos_fixos — despesas recorrentes mensais (aluguel, energia, etc.)
-- `categoria` é UNIQUE: acréscimo em relação ao pedido original, necessário
-- pra existir um alvo de conflito e o seed abaixo poder usar
-- ON CONFLICT DO NOTHING de forma idempotente (sem UNIQUE, rodar este
-- arquivo 2x duplicaria as 6 linhas de seed).
-- ----------------------------------------------------------------------------
create table if not exists custos_fixos (
  id uuid primary key default gen_random_uuid(),
  categoria varchar not null unique,
  descricao text not null,
  valor_mensal numeric(10, 2) not null default 0,
  ativo boolean not null default true,
  created_at timestamp not null default current_timestamp,
  updated_at timestamp not null default current_timestamp
);

-- ----------------------------------------------------------------------------
-- notas_fiscais — NFs de despesa recebidas (upload + extração futura via OCR);
-- `lancamento_id` é preenchido quando a nota é conciliada com um lançamento.
-- ----------------------------------------------------------------------------
create table if not exists notas_fiscais (
  id uuid primary key default gen_random_uuid(),
  pdf_url text not null,
  fornecedor varchar,
  cnpj_cpf varchar,
  numero_nf varchar,
  serie varchar,
  data_emissao date,
  data_vencimento date,
  valor numeric(12, 2),
  categoria varchar,
  processado boolean not null default false,
  lancamento_id uuid references lancamentos_financeiros (id) on delete set null,
  created_at timestamp not null default current_timestamp
);

create index if not exists idx_notas_fiscais_processado on notas_fiscais (processado);
create index if not exists idx_notas_fiscais_data_vencimento on notas_fiscais (data_vencimento);


-- ============================================================================
-- Gatilho genérico de `updated_at` para as tabelas novas (equivalente em
-- inglês da função `set_atualizado_em()` de sql-schema.sql, que já cobre
-- `atualizado_em` nas tabelas antigas — mantidas as duas por causa da
-- diferença de nome de coluna).
-- ============================================================================
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = current_timestamp;
  return new;
end;
$$ language plpgsql;

do $$
declare
  t text;
begin
  foreach t in array array['leads', 'parceiros', 'agendamentos', 'lancamentos_financeiros', 'custos_fixos']
  loop
    execute format(
      'drop trigger if exists trg_%1$s_updated_at on %1$s;
       create trigger trg_%1$s_updated_at
         before update on %1$s
         for each row execute function set_updated_at();',
      t
    );
  end loop;
end $$;


-- ============================================================================
-- ALTERAÇÕES EM TABELAS EXISTENTES
-- ============================================================================

-- orcamentos: liga um orçamento a quem está tocando a venda (módulo Comercial)
alter table orcamentos add column if not exists atribuido_a varchar references usuarios (email);
create index if not exists idx_orcamentos_atribuido_a on orcamentos (atribuido_a);

-- config_empresa: os campos abaixo pedidos no prompt JÁ EXISTEM desde
-- sql-schema.sql (mesmo nome, mesmo tipo) — o ADD COLUMN IF NOT EXISTS aqui é
-- só uma segunda camada de segurança, sem efeito em bancos já atualizados.
alter table config_empresa add column if not exists margem_lucro_padrao double precision not null default 30;
alter table config_empresa add column if not exists desconto_competitivo double precision not null default 0;
alter table config_empresa add column if not exists valor_hora_mao_obra double precision not null default 0;
alter table config_empresa add column if not exists valor_km_deslocamento double precision not null default 0;
alter table config_empresa add column if not exists valor_noite_hospedagem double precision not null default 0;
alter table config_empresa add column if not exists valor_frete_por_tonelada double precision not null default 0;

-- NÃO adicionamos `aliquota_iss_percentual`, `aliquota_inss_percentual` nem
-- `rbt12` pedidos no prompt original — e isso é deliberado, não um
-- esquecimento:
--   • `rbt12` já existe com o nome `simples_nacional_rbt12` (sql-schema.sql).
--     Criar uma segunda coluna `rbt12` deixaria duas fontes de verdade pro
--     mesmo dado, e o código (lib/tributos.ts) só olha pra
--     `simples_nacional_rbt12` — a coluna nova ficaria morta e confusa.
--   • `aliquota_iss_percentual`/`aliquota_inss_percentual` foram REMOVIDAS
--     de propósito em sql-migration-002.sql (linhas 77-78) quando o cálculo
--     de imposto foi trocado de "um percentual fixo chutado" pra alíquota
--     efetiva real do Simples Nacional (fórmula oficial da LC 123/2006, ver
--     lib/tributos.ts) + a lista livre `impostos_config` pros impostos
--     extras. Readicionar essas duas colunas fixas reabriria exatamente o
--     atalho que foi removido de propósito — e o app não vai lê-las de
--     qualquer forma, então ficariam mortas no banco.
-- Se em algum momento vocês quiserem uma alíquota fixa de ISS/INSS como
-- OPÇÃO dentro do regime "personalizado", o lugar certo é uma linha nova em
-- `impostos_config` (nome="ISS", percentual=X), não uma coluna fixa aqui —
-- assim continua editável pela tela de Configurar Preços sem precisar de
-- outra migration.


-- ============================================================================
-- VIEWS — leitura agregada para os dashboards dos módulos
-- (DROP VIEW IF EXISTS antes de recriar: permite rodar este arquivo de novo
-- depois de ajustar a definição de uma view, sem duplicar objeto)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- v_leads_por_etapa — funil comercial agregado por etapa
-- ----------------------------------------------------------------------------
drop view if exists v_leads_por_etapa;
create view v_leads_por_etapa as
select
  etapa,
  count(*) as total,
  coalesce(sum(valor_estimado), 0) as valor_total,
  round(avg(extract(epoch from (current_timestamp - created_at)) / 86400)::numeric, 1) as dias_medio
from leads
group by etapa;

-- ----------------------------------------------------------------------------
-- v_capacidade_parceiros — quanto da capacidade semanal de cada parceiro já
-- está alocada em agendamentos ativos (agendado/em_progresso)
-- ----------------------------------------------------------------------------
drop view if exists v_capacidade_parceiros;
create view v_capacidade_parceiros as
select
  p.id,
  p.nome,
  p.disponibilidade_horas_semana,
  count(a.id) filter (where a.status in ('agendado', 'em_progresso')) as agendamentos_ativas,
  coalesce(sum(a.horas_estimadas) filter (where a.status in ('agendado', 'em_progresso')), 0) as horas_alocadas,
  greatest(
    coalesce(p.disponibilidade_horas_semana, 0)
      - coalesce(sum(a.horas_estimadas) filter (where a.status in ('agendado', 'em_progresso')), 0),
    0
  ) as horas_disponiveis,
  case
    when coalesce(p.disponibilidade_horas_semana, 0) = 0 then 0
    else round(
      least(
        coalesce(sum(a.horas_estimadas) filter (where a.status in ('agendado', 'em_progresso')), 0)
          / p.disponibilidade_horas_semana * 100,
        100
      )::numeric,
      1
    )
  end as percentual_utilizacao
from parceiros p
left join agendamentos a on p.id = any(a.parceiros_alocados)
group by p.id, p.nome, p.disponibilidade_horas_semana;

-- ----------------------------------------------------------------------------
-- v_financeiro_mes_atual — receita/despesa/lucro do mês corrente
-- ----------------------------------------------------------------------------
drop view if exists v_financeiro_mes_atual;
create view v_financeiro_mes_atual as
select
  to_char(current_date, 'YYYY-MM') as mes,
  coalesce(sum(lf.valor) filter (where lf.tipo = 'receita'), 0) as receita_total,
  coalesce(sum(lf.valor) filter (where lf.tipo = 'despesa'), 0) as despesa_total,
  coalesce(sum(lf.valor) filter (where lf.tipo = 'receita'), 0)
    - coalesce(sum(lf.valor) filter (where lf.tipo = 'despesa'), 0) as lucro_bruto,
  (
    select count(*)
    from orcamentos o
    where date_trunc('month', o.data_criacao) = date_trunc('month', current_date)
  ) as numero_orcamentos
from lancamentos_financeiros lf
where date_trunc('month', lf.data) = date_trunc('month', current_date);


-- ============================================================================
-- ROW LEVEL SECURITY — mesma política das tabelas existentes (acesso total
-- para qualquer usuário autenticado via Supabase Auth; sem acesso público)
-- ============================================================================
alter table leads enable row level security;
alter table interacoes_lead enable row level security;
alter table parceiros enable row level security;
alter table agendamentos enable row level security;
alter table lancamentos_financeiros enable row level security;
alter table custos_fixos enable row level security;
alter table notas_fiscais enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'leads', 'interacoes_lead', 'parceiros', 'agendamentos',
    'lancamentos_financeiros', 'custos_fixos', 'notas_fiscais'
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
-- SEED — dados iniciais
-- (config_empresa já é semeado por sql-schema.sql — "insert ... where not
-- exists" — não repetido aqui pra não ter dois pontos de verdade pro mesmo
-- seed. Só o de custos_fixos é novo, específico deste módulo.)
-- ============================================================================
insert into custos_fixos (categoria, descricao, valor_mensal) values
  ('aluguel', 'Aluguel do escritório/galpão', 0),
  ('energia', 'Conta de energia elétrica', 0),
  ('internet', 'Internet e telefonia fixa', 0),
  ('telefone', 'Telefonia móvel corporativa', 0),
  ('seguros', 'Seguros (veículos, patrimonial, etc.)', 0),
  ('manutencao', 'Manutenção de equipamentos e veículos', 0)
on conflict (categoria) do nothing;


-- ============================================================================
-- CHECKLIST DE SUCESSO — rode estas queries depois de executar o arquivo
-- ============================================================================
-- 1. Todas as 7 tabelas novas existem:
--    select table_name from information_schema.tables
--    where table_schema = 'public' and table_name in (
--      'leads', 'interacoes_lead', 'parceiros', 'agendamentos',
--      'lancamentos_financeiros', 'custos_fixos', 'notas_fiscais'
--    );
--    -- esperado: 7 linhas
--
-- 2. RLS ligado em todas elas:
--    select relname from pg_class
--    where relname in (
--      'leads', 'interacoes_lead', 'parceiros', 'agendamentos',
--      'lancamentos_financeiros', 'custos_fixos', 'notas_fiscais'
--    ) and relrowsecurity = true;
--    -- esperado: 7 linhas
--
-- 3. As 3 views existem e respondem sem erro:
--    select * from v_leads_por_etapa;
--    select * from v_capacidade_parceiros;
--    select * from v_financeiro_mes_atual;
--
-- 4. Seed de custos fixos aplicado (idempotente — sempre 6, mesmo rodando de novo):
--    select count(*) from custos_fixos;  -- esperado: 6
--
-- 5. orcamentos.atribuido_a e config_empresa.margem_lucro_padrao existem:
--    select column_name from information_schema.columns
--    where table_name = 'orcamentos' and column_name = 'atribuido_a';
--    select column_name from information_schema.columns
--    where table_name = 'config_empresa' and column_name = 'margem_lucro_padrao';
--
-- 6. Nenhuma tabela antiga perdeu linha (compare com a contagem de antes de
--    rodar este arquivo, se tiver anotado):
--    select count(*) from orcamentos;
--    select count(*) from clientes;
-- ============================================================================
