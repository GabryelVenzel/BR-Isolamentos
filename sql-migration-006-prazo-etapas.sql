-- ============================================================================
-- BR Isolamentos — Migração 006: prazo máximo por etapa (leads "atrasados")
--
-- Pré-requisito: sql-migration-005-crm-avancado.sql já aplicado (cria
-- `historico_mudancas_leads`, usado aqui pra calcular há quantos dias um
-- lead está na etapa atual).
--
-- 100% aditiva e idempotente, mesmas regras dos arquivos anteriores.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- config_prazo_etapas — quantos dias um lead pode ficar em cada etapa antes
-- de ser considerado "atrasado" (linha única, id fixo = 1, mesmo padrão de
-- config_empresa / config_reativacao_leads_frios — NÃO confundir com essa
-- última: aquela é o prazo de RETORNO de um lead FRIO, esta é o prazo de
-- PERMANÊNCIA aceitável em cada etapa do funil, independente de temperatura).
-- Etapas terminais (fechado/perdido) não têm prazo — não faz sentido "atrasar"
-- num lugar de onde o lead não vai mais sair.
-- ----------------------------------------------------------------------------
create table if not exists config_prazo_etapas (
  id serial primary key,
  dias_prospeccao int not null default 7,
  dias_contato int not null default 10,
  dias_proposta int not null default 15,
  dias_negociacao int not null default 20,
  updated_at timestamptz not null default now()
);

insert into config_prazo_etapas (id, dias_prospeccao, dias_contato, dias_proposta, dias_negociacao)
values (1, 7, 10, 15, 20)
on conflict (id) do nothing;

drop trigger if exists trg_config_prazo_etapas_updated_at on config_prazo_etapas;
create trigger trg_config_prazo_etapas_updated_at
  before update on config_prazo_etapas
  for each row execute function set_updated_at();

alter table config_prazo_etapas enable row level security;

drop policy if exists "authenticated_all_config_prazo_etapas" on config_prazo_etapas;
create policy "authenticated_all_config_prazo_etapas" on config_prazo_etapas
  for all
  to authenticated
  using (true)
  with check (true);

-- ============================================================================
-- Como aplicar: cole este arquivo inteiro no SQL Editor do Supabase e rode.
-- Verificação: select * from config_prazo_etapas;
-- ============================================================================
