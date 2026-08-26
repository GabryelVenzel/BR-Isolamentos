-- ============================================================================
-- BR Isolamentos — Migração 015: unifica "Tipo de fornecimento" +
-- "Especialidade" num único campo de múltipla escolha, e anexos de
-- fornecedor.
--
-- Pré-requisito: sql-migration-014-especialidade-fornecedor.sql já
-- aplicado. Idempotente.
--
-- DECISÕES DE PROJETO (leia antes de aplicar):
--
-- 1) `fornecedores.especialidade` (dropdown único, adicionado na migração
--    014 — HOJE, mesma sessão) é REMOVIDA, igual à mesma exceção já
--    documentada em 014: nenhum fornecedor real tem esse campo preenchido
--    ainda, então não há dado em risco.
--
-- 2) `fornecedores.tipo_fornecimento` (dropdown único: materiais/
--    equipamentos/serviços, existe desde sql-migration-008) NÃO é removida
--    — diferente de `especialidade`, essa coluna é mais antiga e pode ter
--    fornecedores reais já cadastrados com ela preenchida. Fica no schema
--    por compatibilidade; a UI para de escrever nela. Não dá pra
--    "aproveitar" o valor existente na coluna nova (`tipos_fornecimento`)
--    porque as categorias são outra taxonomia (materiais/equipamentos/
--    serviços ≠ isolantes/chaparia/ferramentas/ferragens/outros) — um
--    fornecedor com `tipo_fornecimento = 'materiais'` não diz QUAL
--    material, então não tem como inferir `tipos_fornecimento`
--    automaticamente. Fornecedores já cadastrados ficam com
--    `tipos_fornecimento = '{}'` até serem editados de novo.
--
-- 3) `tipos_fornecimento` reaproveita os mesmos 5 valores que
--    `especialidade` tinha (Isolantes/Chaparia/Ferramentas/Ferragens/
--    Outros) — agora como array, permitindo múltipla escolha (um
--    fornecedor pode fornecer Isolantes E Ferragens ao mesmo tempo).
-- ============================================================================

alter table fornecedores drop constraint if exists fornecedores_especialidade_check;
alter table fornecedores drop column if exists especialidade;

alter table fornecedores add column if not exists tipos_fornecimento text[] not null default '{}';

alter table fornecedores drop constraint if exists fornecedores_tipos_fornecimento_check;
alter table fornecedores add constraint fornecedores_tipos_fornecimento_check
  check (tipos_fornecimento <@ array['isolantes', 'chaparia', 'ferramentas', 'ferragens', 'outros']);


-- ============================================================================
-- fornecedor_anexos — mesmo padrão de parceiro_anexos (ver sql-migration-013)
-- ============================================================================
create table if not exists fornecedor_anexos (
  id uuid primary key default gen_random_uuid(),
  fornecedor_id uuid not null references fornecedores (id) on delete cascade,
  nome_arquivo varchar not null,
  tipo_arquivo varchar not null,
  tamanho_bytes bigint not null,
  storage_path text not null,
  url text not null,
  data_adicao timestamptz not null default now(),
  adicionado_por varchar references usuarios (email)
);

create index if not exists idx_fornecedor_anexos_fornecedor_id on fornecedor_anexos (fornecedor_id);

alter table fornecedor_anexos enable row level security;

drop policy if exists "authenticated_all_fornecedor_anexos" on fornecedor_anexos;
create policy "authenticated_all_fornecedor_anexos" on fornecedor_anexos
  for all
  to authenticated
  using (true)
  with check (true);

insert into storage.buckets (id, name, public)
values ('fornecedores-anexos', 'fornecedores-anexos', true)
on conflict (id) do nothing;

drop policy if exists "authenticated_insert_fornecedores_anexos" on storage.objects;
create policy "authenticated_insert_fornecedores_anexos" on storage.objects
  for insert to authenticated with check (bucket_id = 'fornecedores-anexos');

drop policy if exists "authenticated_delete_fornecedores_anexos" on storage.objects;
create policy "authenticated_delete_fornecedores_anexos" on storage.objects
  for delete to authenticated using (bucket_id = 'fornecedores-anexos');


-- ============================================================================
-- Como aplicar: cole este arquivo inteiro no SQL Editor do Supabase e rode.
--
-- Verificação rápida:
--   select column_name from information_schema.columns where table_name = 'fornecedores' and column_name = 'especialidade'; -- deve vir vazio
--   select nome, tipos_fornecimento from fornecedores limit 5;
--   select * from storage.buckets where id = 'fornecedores-anexos';
-- ============================================================================
