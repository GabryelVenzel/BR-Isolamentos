-- ============================================================================
-- Migração 042 — Validade de documentos e prazos dos alertas
-- ============================================================================
-- Base da central de pendências (sino na barra superior):
--
--   1. `validade` (data, opcional) em `funcionario_anexos` (ASO, NRs,
--      certificações...) e em `documentos_empresa` (PGR, PCMSO, certidões...).
--      Documento sem validade preenchida simplesmente não gera alerta.
--   2. Tabela `config_alertas` (linha única, id = 1) com os dois prazos de
--      antecedência dos avisos:
--        - `dias_contas_a_vencer`     (padrão 7)  — contas a pagar/receber;
--        - `dias_documentos_a_vencer` (padrão 30) — documentos.
--      Todo usuário ativo lê; só administrador altera.
--
-- NADA é apagado. As colunas novas nascem vazias.
--
-- ORDEM: rodar ANTES de publicar o código deste bloco (as telas de
-- documentos passam a ler e gravar `validade`). É seguro rodar com a versão
-- atual do site no ar. Depende da migração 039 (funções `usuario_ativo` e
-- `usuario_admin`).
--
-- Idempotente — pode rodar mais de uma vez.
-- ============================================================================

alter table funcionario_anexos add column if not exists validade date;
alter table documentos_empresa add column if not exists validade date;

create index if not exists idx_funcionario_anexos_validade on funcionario_anexos (validade) where validade is not null;
create index if not exists idx_documentos_empresa_validade on documentos_empresa (validade) where validade is not null;

create table if not exists config_alertas (
  id int primary key default 1 check (id = 1),
  dias_contas_a_vencer int not null default 7 check (dias_contas_a_vencer between 0 and 90),
  dias_documentos_a_vencer int not null default 30 check (dias_documentos_a_vencer between 0 and 365),
  updated_at timestamptz not null default now()
);

insert into config_alertas (id) values (1) on conflict (id) do nothing;

alter table config_alertas enable row level security;

drop policy if exists "acesso_config_alertas_leitura" on config_alertas;
create policy "acesso_config_alertas_leitura" on config_alertas
  for select to authenticated
  using (public.usuario_ativo());

drop policy if exists "acesso_config_alertas_alteracao" on config_alertas;
create policy "acesso_config_alertas_alteracao" on config_alertas
  for update to authenticated
  using (public.usuario_admin())
  with check (public.usuario_admin());

-- Alterações nos prazos entram no registro de auditoria, como as outras
-- tabelas de configuração.
drop trigger if exists trg_auditoria on config_alertas;
create trigger trg_auditoria
  after insert or update or delete on config_alertas
  for each row execute function public.registrar_auditoria();

-- ============================================================================
-- VERIFICAÇÃO
--
--   select * from config_alertas;                 -- 1 linha: 7 e 30
--   select nome, validade from documentos_empresa limit 5;
--   select nome, validade from funcionario_anexos limit 5;
-- ============================================================================
