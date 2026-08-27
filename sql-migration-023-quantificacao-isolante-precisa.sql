-- ============================================================================
-- BR Isolamentos — Migração 023: novos padrões de acréscimo de
-- isolante/chaparia (20%→10%, 30%→20%), acompanhando o motor de
-- quantificação mais preciso (lib/usecases/orcamento/escopo.ts#
-- areaBaseIsolamentoEscopo — calcula a área da superfície JÁ ISOLADA,
-- diâmetro do tubo + 2 espessuras, em vez de aplicar o acréscimo direto
-- sobre a área do tubo nu).
--
-- Pré-requisito: sql-migration-022-imagens-proposta-por-tipo.sql já aplicado.
-- 100% aditiva e idempotente — NENHUMA coluna nova, só ajusta o valor
-- padrão de duas colunas que já existem desde a migração 019.
--
-- DECISÃO: só atualiza o valor de `config_empresa` se ele ainda estiver no
-- padrão ANTIGO (20.00/30.00) — se a empresa já tiver personalizado esses
-- percentuais pra outro valor, essa mudança de motor de cálculo não
-- sobrescreve a escolha feita. Quem quiser os novos padrões numa
-- configuração já customizada ajusta manualmente em Configurar Preços.
-- ============================================================================

alter table config_empresa alter column isolante_acrescimo_percentual set default 10.00;
alter table config_empresa alter column acabamento_acrescimo_percentual set default 20.00;

update config_empresa set isolante_acrescimo_percentual = 10.00 where isolante_acrescimo_percentual = 20.00;
update config_empresa set acabamento_acrescimo_percentual = 20.00 where acabamento_acrescimo_percentual = 30.00;

-- ============================================================================
-- Como aplicar: cole este arquivo inteiro no SQL Editor do Supabase e rode.
--
-- Verificação rápida:
--   select isolante_acrescimo_percentual, acabamento_acrescimo_percentual from config_empresa;
-- ============================================================================
