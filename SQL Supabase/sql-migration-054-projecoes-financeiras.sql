-- ============================================================================
-- Migração 054 — Projeções financeiras (Financeiro → Projeção)
-- ============================================================================
-- O que muda:
--
--   `projecoes_financeiras` (NOVA): lançamentos PREVISTOS simplificados —
--   tipo (receita/despesa), categoria, descrição, valor e vencimento. Sem
--   anexo, competência, forma de pagamento, parcelamento ou repetição.
--
--   Servem só para planejar: entram no fluxo de caixa (por mês e D+90) e nos
--   demais indicadores financeiros do Resumo, mas NÃO aparecem em
--   Lançamentos nem no resultado por obra (que só considera o realizado).
--   Deixam de contar sozinhas no dia seguinte ao vencimento — o sistema
--   simplesmente ignora as que já venceram; não é preciso apagar.
--
-- Acesso: quem tem Financeiro cadastra e edita; quem tem Financeiro ou
-- Resumo lê (os dashboards do Resumo usam).
--
-- ORDEM: rodar ANTES de publicar o código deste bloco. É seguro rodar com a
-- versão atual do site no ar. Depende da migração 039.
--
-- Idempotente — pode rodar mais de uma vez.
-- ============================================================================

create table if not exists projecoes_financeiras (
  id uuid primary key default gen_random_uuid(),
  tipo varchar not null check (tipo in ('receita', 'despesa')),
  categoria varchar not null,
  descricao varchar not null,
  valor numeric(14, 2) not null check (valor > 0),
  data date not null,
  criado_por varchar,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_projecoes_financeiras_data on projecoes_financeiras (data);

alter table projecoes_financeiras enable row level security;

drop policy if exists "acesso_projecoes_leitura" on projecoes_financeiras;
create policy "acesso_projecoes_leitura" on projecoes_financeiras
  for select to authenticated using (public.tem_modulo('financeiro', 'resumo'));

drop policy if exists "acesso_projecoes_gravacao" on projecoes_financeiras;
create policy "acesso_projecoes_gravacao" on projecoes_financeiras
  for all to authenticated using (public.tem_modulo('financeiro')) with check (public.tem_modulo('financeiro'));

drop trigger if exists trg_auditoria on projecoes_financeiras;
create trigger trg_auditoria after insert or update or delete on projecoes_financeiras
  for each row execute function public.registrar_auditoria();

-- ============================================================================
-- VERIFICAÇÃO
--
--   select count(*) from projecoes_financeiras;   -- 0 logo após rodar
--   select policyname from pg_policies where tablename = 'projecoes_financeiras';
-- ============================================================================
