-- ============================================================================
-- BR Isolamentos — Migração 011: serviços com múltiplos tipos de trabalho.
--
-- Pré-requisito: sql-migration-010-orcamento-escopo-materiais.sql já aplicado.
-- 100% aditiva e idempotente.
--
-- DECISÃO: `servicos.tipo_trabalho` (singular, existente) NÃO foi removida —
-- vira um espelho do primeiro item de `tipos_trabalho` (nova coluna, array),
-- escrito automaticamente por criarServico.ts/atualizarServico.ts. Isso evita
-- reescrever a lógica de agrupamento "por tipo" dos relatórios operacionais
-- (tempo de execução por tipo, custo real vs orçado por tipo — ver
-- lib/usecases/operacional/relatorio.ts) e dos filtros existentes
-- (?tipo_trabalho= nas rotas de relatório) para serem multi-tipo-aware, o
-- que é uma mudança maior fora do escopo deste pedido — o pedido só cobria
-- "criar serviço com múltiplos tipos" e "exibir múltiplos tipos no card",
-- não "recalcular relatórios agrupados por combinação de tipos".
-- ============================================================================

alter table servicos add column if not exists tipos_trabalho text[] not null default '{}';

-- Backfill: serviços já existentes ganham um array de 1 item = o tipo que já tinham.
update servicos set tipos_trabalho = array[tipo_trabalho]
where tipo_trabalho is not null and tipos_trabalho = '{}';

-- ============================================================================
-- Como aplicar: cole este arquivo inteiro no SQL Editor do Supabase e rode.
--
-- Verificação rápida:
--   select numero_servico, tipo_trabalho, tipos_trabalho from servicos limit 5;
-- ============================================================================
