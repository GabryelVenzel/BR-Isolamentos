-- ============================================================================
-- BR Isolamentos — Migração 012: anexos de documentos no Lead (Comercial).
--
-- Pré-requisito: sql-migration-011-servicos-multiplos-tipos.sql já aplicado.
-- 100% aditiva e idempotente.
--
-- DECISÃO: tabela própria (`anexos_lead`, uma linha por arquivo), não um
-- array jsonb na própria `leads` — pedido explícito veio com esse desenho de
-- schema, e uma tabela própria também permite excluir/consultar um anexo
-- direto por id sem reescrever um array inteiro (diferente de
-- `lancamentos_financeiros.anexos`, migração 009, que é jsonb de propósito
-- porque reservava campos de uma feature futura de validação por IA — não é
-- o caso aqui). Mesmo padrão de bucket dedicado + RLS das migrações
-- anteriores (servicos-anexos migração 008, lancamentos-anexos migração 009).
-- ============================================================================

create table if not exists anexos_lead (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads (id) on delete cascade,
  nome_arquivo varchar not null,
  tipo_arquivo varchar not null, -- extensão/mime simplificado: pdf, docx, xlsx, jpg, png, etc.
  tamanho_bytes bigint not null,
  storage_path text not null,
  url text not null,
  data_adicao timestamptz not null default now(),
  adicionado_por varchar references usuarios (email)
);

create index if not exists idx_anexos_lead_lead_id on anexos_lead (lead_id);

alter table anexos_lead enable row level security;

drop policy if exists "authenticated_all_anexos_lead" on anexos_lead;
create policy "authenticated_all_anexos_lead" on anexos_lead
  for all
  to authenticated
  using (true)
  with check (true);

insert into storage.buckets (id, name, public)
values ('leads-anexos', 'leads-anexos', true)
on conflict (id) do nothing;

drop policy if exists "authenticated_insert_leads_anexos" on storage.objects;
create policy "authenticated_insert_leads_anexos" on storage.objects
  for insert to authenticated with check (bucket_id = 'leads-anexos');

drop policy if exists "authenticated_delete_leads_anexos" on storage.objects;
create policy "authenticated_delete_leads_anexos" on storage.objects
  for delete to authenticated using (bucket_id = 'leads-anexos');

-- ============================================================================
-- Como aplicar: cole este arquivo inteiro no SQL Editor do Supabase e rode.
--
-- Verificação rápida:
--   select * from anexos_lead limit 1;
--   select * from storage.buckets where id = 'leads-anexos';
-- ============================================================================
