-- ============================================================================
-- Migração 045 — Lixeira de serviços, exclusão só por administrador e
--                linha do tempo/interações na auditoria
-- ============================================================================
-- Em 12/10/2026 a obra S00003 foi excluída por engano. Deu para restaurar
-- quase tudo pela auditoria, mas a linha do tempo e as interações se perderam
-- (não eram auditadas) e a exclusão era imediata e definitiva.
--
-- O que muda:
--   1. `servicos.excluido_em` / `servicos.excluido_por` — "Excluir" um serviço
--      passa a só marcá-lo como excluído (vai para a LIXEIRA): ele some das
--      telas, mas continua no banco com parceiros, diárias, linha do tempo,
--      interações e o vínculo dos lançamentos intactos. Da lixeira o
--      administrador pode RESTAURAR ou EXCLUIR DEFINITIVAMENTE; o que ficar
--      30 dias na lixeira é removido de vez pela rotina diária.
--   2. Regra de acesso de `servicos`: ler, criar e alterar continuam com
--      qualquer usuário ativo; APAGAR de verdade (delete) só administrador.
--      (O app também só mostra o botão "Excluir" para administradores.)
--   3. Auditoria passa a cobrir a linha do tempo e as interações — de
--      serviços (`historico_servicos`, `interacoes_servico`) e, pelo mesmo
--      motivo, de leads (`historico_mudancas_leads`, `interacoes_lead`).
--      Assim, mesmo uma exclusão definitiva pode ser reconstruída por
--      inteiro a partir do registro de alterações.
--
-- NADA é apagado por esta migração.
--
-- ORDEM: rodar ANTES de publicar o código deste bloco (as telas passam a
-- filtrar por `excluido_em`). É seguro rodar com a versão atual do site no
-- ar. Depende da migração 039.
--
-- Idempotente — pode rodar mais de uma vez.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Lixeira de serviços
-- ----------------------------------------------------------------------------
alter table servicos add column if not exists excluido_em timestamptz;
alter table servicos add column if not exists excluido_por varchar;

create index if not exists idx_servicos_excluido_em on servicos (excluido_em) where excluido_em is not null;

-- ----------------------------------------------------------------------------
-- 2. Apagar serviço de verdade: só administrador
-- ----------------------------------------------------------------------------
drop policy if exists "acesso_ativo_servicos" on servicos;

drop policy if exists "acesso_servicos_leitura" on servicos;
create policy "acesso_servicos_leitura" on servicos
  for select to authenticated
  using (public.usuario_ativo());

drop policy if exists "acesso_servicos_inclusao" on servicos;
create policy "acesso_servicos_inclusao" on servicos
  for insert to authenticated
  with check (public.usuario_ativo());

drop policy if exists "acesso_servicos_alteracao" on servicos;
create policy "acesso_servicos_alteracao" on servicos
  for update to authenticated
  using (public.usuario_ativo())
  with check (public.usuario_ativo());

drop policy if exists "acesso_servicos_exclusao" on servicos;
create policy "acesso_servicos_exclusao" on servicos
  for delete to authenticated
  using (public.usuario_admin());

-- ----------------------------------------------------------------------------
-- 3. Linha do tempo e interações na auditoria
-- ----------------------------------------------------------------------------
drop trigger if exists trg_auditoria on historico_servicos;
create trigger trg_auditoria
  after insert or update or delete on historico_servicos
  for each row execute function public.registrar_auditoria();

drop trigger if exists trg_auditoria on interacoes_servico;
create trigger trg_auditoria
  after insert or update or delete on interacoes_servico
  for each row execute function public.registrar_auditoria();

drop trigger if exists trg_auditoria on historico_mudancas_leads;
create trigger trg_auditoria
  after insert or update or delete on historico_mudancas_leads
  for each row execute function public.registrar_auditoria();

drop trigger if exists trg_auditoria on interacoes_lead;
create trigger trg_auditoria
  after insert or update or delete on interacoes_lead
  for each row execute function public.registrar_auditoria();

-- ============================================================================
-- VERIFICAÇÃO
--
-- 1) Colunas da lixeira (nenhum serviço deve estar marcado ainda):
--   select numero_servico, excluido_em, excluido_por from servicos;
--
-- 2) Regras de `servicos` (4 linhas; a de DELETE usa usuario_admin):
--   select policyname, cmd, qual from pg_policies where tablename = 'servicos';
--
-- 3) Gatilhos de auditoria novos (4 linhas):
--   select event_object_table from information_schema.triggers
--    where trigger_name = 'trg_auditoria'
--      and event_object_table in ('historico_servicos', 'interacoes_servico', 'historico_mudancas_leads', 'interacoes_lead')
--    group by 1 order by 1;
-- ============================================================================
