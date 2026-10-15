-- ============================================================================
-- Migração 053 — Saldo inicial do caixa, parceiros separados (prestadores x
--                parcerias) e vários orçamentos por lead
-- ============================================================================
-- O que muda:
--
--   1. Caixa (`config_empresa`): `caixa_data_inicial` e `caixa_saldo_inicial`
--      — o ponto de partida do fluxo de caixa do Resumo. A empresa começou
--      com o caixa zerado em 28/09/2026; o saldo de hoje passa a ser esse
--      saldo inicial + tudo que foi pago/recebido a partir dessa data.
--      Editável em Financeiro → Configurações.
--
--   2. Parceiros: a categoria "ambos" deixa de existir — Prestadores e
--      Parcerias viram subabas separadas no Operacional. Quem estiver como
--      "ambos" passa a "prestador" (hoje não há nenhum).
--
--   3. `lead_orcamentos` (NOVA): um lead pode ter vários orçamentos
--      vinculados. `vencedor` marca o(s) orçamento(s) fechado(s) quando o
--      lead vai para "Fechado". Os vínculos atuais (`leads.orcamento_id`) são
--      copiados para cá; a coluna antiga fica no banco, sem uso, para não
--      perder histórico.
--
-- ORDEM: rodar ANTES de publicar o código deste bloco. É seguro rodar com a
-- versão atual do site no ar. Depende das migrações 027, 039 e 047.
--
-- Idempotente — pode rodar mais de uma vez.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Saldo inicial do caixa
-- ----------------------------------------------------------------------------
alter table config_empresa add column if not exists caixa_data_inicial date not null default '2026-09-28';
alter table config_empresa add column if not exists caixa_saldo_inicial numeric(14, 2) not null default 0;

-- ----------------------------------------------------------------------------
-- 2. Parceiros: só prestador ou parceria
-- ----------------------------------------------------------------------------
update parceiros set categoria_parceiro = 'prestador' where categoria_parceiro = 'ambos';

alter table parceiros drop constraint if exists parceiros_categoria_parceiro_check;
alter table parceiros add constraint parceiros_categoria_parceiro_check
  check (categoria_parceiro in ('prestador', 'parceria'));

-- ----------------------------------------------------------------------------
-- 3. Vários orçamentos por lead
-- ----------------------------------------------------------------------------
create table if not exists lead_orcamentos (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads (id) on delete cascade,
  orcamento_id integer not null references orcamentos (id) on delete cascade,
  vencedor boolean not null default false,
  created_at timestamptz not null default now(),
  unique (lead_id, orcamento_id)
);

create index if not exists idx_lead_orcamentos_lead on lead_orcamentos (lead_id);
create index if not exists idx_lead_orcamentos_orcamento on lead_orcamentos (orcamento_id);

-- Vínculos atuais. Lead já fechado: o orçamento dele é o vencedor.
insert into lead_orcamentos (lead_id, orcamento_id, vencedor)
select l.id, l.orcamento_id, l.etapa = 'fechado'
  from leads l
 where l.orcamento_id is not null
   and exists (select 1 from orcamentos o where o.id = l.orcamento_id)
on conflict (lead_id, orcamento_id) do nothing;

alter table lead_orcamentos enable row level security;
drop policy if exists "acesso_lead_orcamentos_leitura" on lead_orcamentos;
create policy "acesso_lead_orcamentos_leitura" on lead_orcamentos
  for select to authenticated using (public.usuario_ativo());
drop policy if exists "acesso_lead_orcamentos_gravacao" on lead_orcamentos;
create policy "acesso_lead_orcamentos_gravacao" on lead_orcamentos
  for all to authenticated using (public.tem_modulo('comercial')) with check (public.tem_modulo('comercial'));

drop trigger if exists trg_auditoria on lead_orcamentos;
create trigger trg_auditoria after insert or update or delete on lead_orcamentos
  for each row execute function public.registrar_auditoria();

-- ============================================================================
-- VERIFICAÇÃO
--
--   select caixa_data_inicial, caixa_saldo_inicial from config_empresa;
--   select categoria_parceiro, count(*) from parceiros group by 1;
--   select count(*) from lead_orcamentos;   -- deve ser igual a:
--   select count(*) from leads where orcamento_id is not null;
-- ============================================================================
