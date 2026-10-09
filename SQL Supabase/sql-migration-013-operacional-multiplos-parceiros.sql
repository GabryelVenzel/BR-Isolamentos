-- ============================================================================
-- BR Isolamentos — Migração 013: múltiplos parceiros por serviço,
-- especialidade do parceiro, anexos de parceiro, unificação de fotos.
--
-- Pré-requisito: sql-migration-012-anexos-lead.sql já aplicado.
-- 100% aditiva e idempotente, mesmas regras dos arquivos anteriores —
-- nenhuma coluna/tabela antiga é removida (ver decisões abaixo).
--
-- DECISÕES DE PROJETO (leia antes de aplicar):
--
-- 1) `servicos.parceiro_principal_id`/`pessoas_alocadas` NÃO são removidas.
--    A partir desta migração, a fonte de verdade pra "quais parceiros estão
--    num serviço e quantas pessoas cada um mobiliza" passa a ser a nova
--    tabela `servico_parceiros_execucao` (um parceiro pode ter 0, 1 ou N
--    linhas por serviço). As colunas antigas ficam só de histórico/
--    compatibilidade com o app antes desta mudança.
--
-- 2) Backfill: todo serviço que já tinha `parceiro_principal_id` preenchido
--    ganha uma linha correspondente em `servico_parceiros_execucao` (com
--    `pessoas_mobilizadas` = `pessoas_alocadas` antigo). Isso é necessário
--    pra Capacidade/Agenda continuarem contando corretamente esses serviços
--    já existentes — ver decisão 3.
--
-- 3) A aba Capacidade/Agenda (lib/usecases/operacional/capacidade.ts) foi
--    reescrita nesta mudança pra somar `pessoas_mobilizadas` de TODOS os
--    parceiros vinculados ao serviço via `servico_parceiros_execucao`, não
--    só de um "parceiro principal". Consequência direta (e correção, não
--    regressão): parceiros de apoio (antes em `parceiros_alocados`, sem
--    headcount, e por isso nunca contados) agora entram na conta de pessoas
--    mobilizadas quando cadastrados pela nova tela "Parceiros" do serviço.
--
-- 4) `parceiros.especialidade` (singular, novo) é um campo DIFERENTE de
--    `parceiros.especialidades` (plural, já existe) — o plural é o modelo
--    antigo por HORAS/semana usado pelo dashboard Resumo
--    (v_capacidade_parceiros); o singular é a classificação fixa nova
--    (Isolantes/Chaparia/Ferramentas/Ferragens/Outros) pedida pra filtrar
--    parceiros ao montar um serviço. Os dois convivem, propósitos distintos.
--
-- 5) Unificação de fotos: `servicos.fotos_url` passa a ser a ÚNICA lista de
--    fotos do serviço na UI (até 20). `foto_principal_url` continua
--    existindo na tabela (nunca apagamos dado), mas o valor já cadastrado é
--    copiado pro INÍCIO de `fotos_url` nesta migração — daí em diante a UI
--    só lê/escreve `fotos_url`, então nenhuma foto já enviada some da tela.
-- ============================================================================


-- ============================================================================
-- servico_parceiros_execucao — múltiplos parceiros por serviço, cada um com
-- seu próprio headcount e tipos de trabalho (ver decisões 1-3 acima).
-- ============================================================================
create table if not exists servico_parceiros_execucao (
  id uuid primary key default gen_random_uuid(),
  servico_id uuid not null references servicos (id) on delete cascade,
  parceiro_id uuid not null references parceiros (id),
  pessoas_mobilizadas int not null default 0,
  tipos_trabalho text[] not null default '{}',
  data_adicao timestamptz not null default now()
);

create index if not exists idx_servico_parceiros_execucao_servico_id on servico_parceiros_execucao (servico_id);
create index if not exists idx_servico_parceiros_execucao_parceiro_id on servico_parceiros_execucao (parceiro_id);

alter table servico_parceiros_execucao enable row level security;

drop policy if exists "authenticated_all_servico_parceiros_execucao" on servico_parceiros_execucao;
create policy "authenticated_all_servico_parceiros_execucao" on servico_parceiros_execucao
  for all
  to authenticated
  using (true)
  with check (true);

-- Backfill (decisão 2) — só insere se ainda não existir uma linha pra esse
-- serviço+parceiro (idempotente, seguro rodar de novo).
insert into servico_parceiros_execucao (servico_id, parceiro_id, pessoas_mobilizadas, tipos_trabalho, data_adicao)
select s.id, s.parceiro_principal_id, coalesce(s.pessoas_alocadas, 0), coalesce(s.tipos_trabalho, '{}'), s.created_at
from servicos s
where s.parceiro_principal_id is not null
  and not exists (
    select 1 from servico_parceiros_execucao e
    where e.servico_id = s.id and e.parceiro_id = s.parceiro_principal_id
  );


-- ============================================================================
-- parceiros.especialidade (decisão 4) + anexos de parceiro
-- ============================================================================
alter table parceiros add column if not exists especialidade varchar;

alter table parceiros drop constraint if exists parceiros_especialidade_check;
alter table parceiros add constraint parceiros_especialidade_check
  check (especialidade is null or especialidade in ('isolantes', 'chaparia', 'ferramentas', 'ferragens', 'outros'));

create table if not exists parceiro_anexos (
  id uuid primary key default gen_random_uuid(),
  parceiro_id uuid not null references parceiros (id) on delete cascade,
  nome_arquivo varchar not null,
  tipo_arquivo varchar not null,
  tamanho_bytes bigint not null,
  storage_path text not null,
  url text not null,
  data_adicao timestamptz not null default now(),
  adicionado_por varchar references usuarios (email)
);

create index if not exists idx_parceiro_anexos_parceiro_id on parceiro_anexos (parceiro_id);

alter table parceiro_anexos enable row level security;

drop policy if exists "authenticated_all_parceiro_anexos" on parceiro_anexos;
create policy "authenticated_all_parceiro_anexos" on parceiro_anexos
  for all
  to authenticated
  using (true)
  with check (true);

insert into storage.buckets (id, name, public)
values ('parceiros-anexos', 'parceiros-anexos', true)
on conflict (id) do nothing;

drop policy if exists "authenticated_insert_parceiros_anexos" on storage.objects;
create policy "authenticated_insert_parceiros_anexos" on storage.objects
  for insert to authenticated with check (bucket_id = 'parceiros-anexos');

drop policy if exists "authenticated_delete_parceiros_anexos" on storage.objects;
create policy "authenticated_delete_parceiros_anexos" on storage.objects
  for delete to authenticated using (bucket_id = 'parceiros-anexos');


-- ============================================================================
-- Unificação de fotos (decisão 5) — copia foto_principal_url pro início de
-- fotos_url, sem apagar a coluna antiga. Idempotente: só roda se a foto
-- ainda não estiver no array (não duplica se a migração rodar de novo).
-- ============================================================================
update servicos
set fotos_url = array_prepend(foto_principal_url, fotos_url)
where foto_principal_url is not null
  and not (foto_principal_url = any(fotos_url));


-- ============================================================================
-- Como aplicar: cole este arquivo inteiro no SQL Editor do Supabase e rode.
--
-- Verificação rápida:
--   select * from servico_parceiros_execucao limit 5;
--   select numero_servico, foto_principal_url, fotos_url from servicos where foto_principal_url is not null limit 5;
--   select especialidade from parceiros limit 5;
--   select * from storage.buckets where id = 'parceiros-anexos';
-- ============================================================================
