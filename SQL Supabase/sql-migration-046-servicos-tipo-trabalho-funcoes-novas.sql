-- ============================================================================
-- Migração 046 — `servicos.tipo_trabalho` aceita todas as funções atuais
-- ============================================================================
-- A coluna `servicos.tipo_trabalho` (migração 008) guarda o PRIMEIRO tipo de
-- trabalho do serviço — espelho de `tipos_trabalho[1]`, usado em filtros e
-- relatórios. A regra criada em 008 só aceita os quatro tipos daquela época
-- ('bancada', 'caldeiraria', 'isolamentos_removiveis', 'isolamentos_fixos') e
-- nunca foi atualizada quando as funções mudaram.
--
-- Efeito: criar ou editar um serviço cujo PRIMEIRO tipo marcado seja Isolador,
-- Funileiro/Traçador, Caldeiraria (montagem), Removível (montagem), Removível
-- (fabricação) ou Ajudante é recusado pelo banco. Só não apareceu antes porque
-- a única obra (S00003) tem "bancada" como primeiro tipo.
--
-- O que muda: a regra passa a aceitar as oito funções atuais do sistema. Os
-- dois nomes antigos continuam aceitos, para não invalidar nenhum registro
-- histórico.
--
-- NADA é apagado ou alterado nos dados.
--
-- ORDEM: pode rodar a qualquer momento, com a versão atual do site no ar.
--
-- Idempotente — pode rodar mais de uma vez.
-- ============================================================================

alter table servicos drop constraint if exists servicos_tipo_trabalho_check;

alter table servicos add constraint servicos_tipo_trabalho_check
  check (
    tipo_trabalho is null
    or tipo_trabalho in (
      'bancada',
      'isolador',
      'funileiro_tracador',
      'caldeiraria',
      'caldeiraria_montagem',
      'removivel_montagem',
      'removivel_fabricacao',
      'ajudante',
      -- nomes antigos (migração 008), mantidos por compatibilidade
      'isolamentos_removiveis',
      'isolamentos_fixos'
    )
  );

-- ============================================================================
-- VERIFICAÇÃO
--
-- A regra nova (1 linha, com as dez opções acima):
--   select pg_get_constraintdef(oid) from pg_constraint
--    where conname = 'servicos_tipo_trabalho_check';
-- ============================================================================
