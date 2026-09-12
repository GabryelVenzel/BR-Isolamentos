-- ============================================================================
-- BR Isolamentos — Migração 033: novo módulo RH (aba de topo nova) — pedido
-- explícito: "criar mais uma aba superior chamada RH, onde conseguimos
-- anexar, salvar e acessar documentações da empresa... e também criar
-- documentações por pessoal".
--
-- 100% aditiva (3 tabelas novas + 2 buckets novos, nenhuma tabela/coluna
-- existente é tocada) e idempotente. NÃO mexe em nada do que já existe
-- (pedido explícito: "sem mudar nada que já está construído").
--
-- DECISÕES DE PROJETO:
--
-- 1) Duas listas separadas, como pedido: "Empresa" (documentos soltos, com
--    nome + anexo — CNPJ, Contrato Social, PGR, PCMSO, contratos...) e
--    "Funcionários" (um cadastro por pessoa, com N documentos cada — ASO,
--    NRs, certificações...). São 3 tabelas: `documentos_empresa` (lista
--    solta), `funcionarios` (cadastro básico) e `funcionario_anexos` (N
--    documentos por funcionário, cada um com seu próprio nome — mesmo
--    padrão de `nome` livre que `documentos_empresa` usa).
--
-- 2) `numero_funcionario` segue o MESMO padrão já usado pra parceiro (P)/
--    fornecedor (F)/serviço (S) — prefixo "C" (Colaborador) + sequência,
--    gerado por trigger na inserção.
--
-- 3) Buckets separados (`rh-empresa-anexos` / `rh-funcionarios-anexos`) —
--    mesmo padrão de `fornecedores-anexos`/`parceiros-anexos`, cada
--    entidade com seu próprio bucket, público (mesma decisão já usada em
--    todos os buckets de anexo deste projeto).
-- ============================================================================

create sequence if not exists seq_numero_funcionario;

create or replace function gerar_numero_funcionario() returns trigger as $$
begin
  if new.numero_funcionario is null then
    new.numero_funcionario := 'C' || lpad(nextval('seq_numero_funcionario')::text, 5, '0');
  end if;
  return new;
end;
$$ language plpgsql;

-- ============================================================================
-- documentos_empresa — lista solta de documentos da empresa (CNPJ, Contrato
-- Social, PGR, PCMSO, contratos...), cada um com um nome dado pelo usuário +
-- 1 anexo. Editável (renomear) e excluível, como pedido.
-- ============================================================================
create table if not exists documentos_empresa (
  id uuid primary key default gen_random_uuid(),
  nome varchar not null,
  nome_arquivo varchar not null,
  tipo_arquivo varchar not null,
  tamanho_bytes bigint not null,
  storage_path text not null,
  url text not null,
  data_adicao timestamptz not null default now(),
  adicionado_por varchar references usuarios (email)
);

create index if not exists idx_documentos_empresa_nome on documentos_empresa (nome);

alter table documentos_empresa enable row level security;

drop policy if exists "authenticated_all_documentos_empresa" on documentos_empresa;
create policy "authenticated_all_documentos_empresa" on documentos_empresa
  for all
  to authenticated
  using (true)
  with check (true);

-- ============================================================================
-- funcionarios — cadastro básico de colaborador. Campos mínimos pra
-- identificar/contatar a pessoa; o grosso da documentação fica em
-- `funcionario_anexos`, não em colunas próprias aqui.
-- ============================================================================
create table if not exists funcionarios (
  id uuid primary key default gen_random_uuid(),
  numero_funcionario varchar(20) unique,
  nome varchar not null,
  cargo varchar,
  cpf varchar,
  telefone varchar,
  email varchar,
  data_admissao date,
  status varchar not null default 'ativo' check (status in ('ativo', 'inativo', 'desligado')),
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_funcionarios_status on funcionarios (status);

drop trigger if exists trg_funcionarios_numero_funcionario on funcionarios;
create trigger trg_funcionarios_numero_funcionario
  before insert on funcionarios
  for each row execute function gerar_numero_funcionario();

-- set_updated_at_generico() já existe desde sql-migration-008 (usada por
-- fornecedores/parceiros) — reaproveitada aqui, não recriada.
drop trigger if exists trg_funcionarios_updated_at on funcionarios;
create trigger trg_funcionarios_updated_at
  before update on funcionarios
  for each row execute function set_updated_at_generico();

alter table funcionarios enable row level security;

drop policy if exists "authenticated_all_funcionarios" on funcionarios;
create policy "authenticated_all_funcionarios" on funcionarios
  for all
  to authenticated
  using (true)
  with check (true);

-- ============================================================================
-- funcionario_anexos — N documentos por funcionário (ASO, NRs,
-- certificações...), mesmo padrão de fornecedor_anexos, mas com um campo
-- `nome` a mais (o documento tem um nome dado pelo usuário, não só o nome
-- cru do arquivo — pedido explícito, mesma ideia de documentos_empresa).
-- ============================================================================
create table if not exists funcionario_anexos (
  id uuid primary key default gen_random_uuid(),
  funcionario_id uuid not null references funcionarios (id) on delete cascade,
  nome varchar not null,
  nome_arquivo varchar not null,
  tipo_arquivo varchar not null,
  tamanho_bytes bigint not null,
  storage_path text not null,
  url text not null,
  data_adicao timestamptz not null default now(),
  adicionado_por varchar references usuarios (email)
);

create index if not exists idx_funcionario_anexos_funcionario_id on funcionario_anexos (funcionario_id);

alter table funcionario_anexos enable row level security;

drop policy if exists "authenticated_all_funcionario_anexos" on funcionario_anexos;
create policy "authenticated_all_funcionario_anexos" on funcionario_anexos
  for all
  to authenticated
  using (true)
  with check (true);

-- ============================================================================
-- STORAGE — 2 buckets novos, mesmo padrão de fornecedores-anexos/
-- parceiros-anexos (público, RLS por policy de insert/delete).
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('rh-empresa-anexos', 'rh-empresa-anexos', true)
on conflict (id) do nothing;

drop policy if exists "authenticated_insert_rh_empresa_anexos" on storage.objects;
create policy "authenticated_insert_rh_empresa_anexos" on storage.objects
  for insert to authenticated with check (bucket_id = 'rh-empresa-anexos');

drop policy if exists "authenticated_delete_rh_empresa_anexos" on storage.objects;
create policy "authenticated_delete_rh_empresa_anexos" on storage.objects
  for delete to authenticated using (bucket_id = 'rh-empresa-anexos');

insert into storage.buckets (id, name, public)
values ('rh-funcionarios-anexos', 'rh-funcionarios-anexos', true)
on conflict (id) do nothing;

drop policy if exists "authenticated_insert_rh_funcionarios_anexos" on storage.objects;
create policy "authenticated_insert_rh_funcionarios_anexos" on storage.objects
  for insert to authenticated with check (bucket_id = 'rh-funcionarios-anexos');

drop policy if exists "authenticated_delete_rh_funcionarios_anexos" on storage.objects;
create policy "authenticated_delete_rh_funcionarios_anexos" on storage.objects
  for delete to authenticated using (bucket_id = 'rh-funcionarios-anexos');

-- ============================================================================
-- Como aplicar: cole este arquivo inteiro no SQL Editor do Supabase e rode.
--
-- Verificação rápida:
--   select * from documentos_empresa limit 5;
--   select numero_funcionario, nome, status from funcionarios limit 5;
--   select * from storage.buckets where id in ('rh-empresa-anexos', 'rh-funcionarios-anexos');
-- ============================================================================
