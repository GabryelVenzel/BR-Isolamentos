-- ============================================================================
-- BR Isolamentos — Migração 022: classifica as imagens de referência
-- (`imagens_proposta`) por tipo de sistema (quente/frio/ambos), pra cada
-- Proposta mostrar só as fotos relevantes ao tipo do orçamento.
--
-- Pré-requisito: sql-migration-021-observacoes-e-validade-proposta.sql já aplicado.
-- 100% aditiva e idempotente.
--
-- DECISÃO: `tipo_trabalho` fica NULL por padrão (fotos já cadastradas antes
-- desta migração) — `null` é tratado como "ambos" na hora de filtrar (ver
-- lib/usecases/orcamento/analiseProposta.ts#imagensRelevantesParaTipo), pra
-- nenhuma foto já cadastrada sumir da Proposta só por não ter sido
-- reclassificada.
-- ============================================================================

alter table imagens_proposta add column if not exists tipo_trabalho varchar;
alter table imagens_proposta drop constraint if exists imagens_proposta_tipo_trabalho_check;
alter table imagens_proposta add constraint imagens_proposta_tipo_trabalho_check
  check (tipo_trabalho is null or tipo_trabalho in ('quente', 'frio', 'ambos'));

-- ============================================================================
-- Como aplicar: cole este arquivo inteiro no SQL Editor do Supabase e rode.
--
-- Verificação rápida:
--   select id, tipo_trabalho from imagens_proposta;
-- ============================================================================
