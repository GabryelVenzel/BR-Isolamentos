-- ============================================================================
-- BR Isolamentos — Migração 030: notas por tipo de trabalho pras 5
-- categorias novas do parceiro (migração 027 tinha ficado só com
-- notas_bancada/notas_caldeiraria, faltando as outras).
--
-- Pré-requisito: sql-migration-029-arame-por-metro.sql já aplicado. 100%
-- aditiva e idempotente.
-- ============================================================================

alter table parceiros add column if not exists notas_isolador text;
alter table parceiros add column if not exists notas_funileiro_tracador text;
alter table parceiros add column if not exists notas_caldeiraria_montagem text;
alter table parceiros add column if not exists notas_removivel_montagem text;
alter table parceiros add column if not exists notas_removivel_fabricacao text;

-- ============================================================================
-- Como aplicar: cole este arquivo inteiro no SQL Editor do Supabase e rode.
-- ============================================================================
