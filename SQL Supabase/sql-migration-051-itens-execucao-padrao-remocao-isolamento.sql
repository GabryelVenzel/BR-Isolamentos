-- ============================================================================
-- Migração 051 — Itens de execução padrão e remoção do isolamento existente
-- ============================================================================
-- Duas novidades no orçamento, as duas com efeito automático em "O orçamento
-- contempla" / "Não contemplado" das propostas:
--
--   1. ITENS DE EXECUÇÃO PADRÃO — equipamentos e serviços de apoio que se
--      repetem de obra em obra (andaime, plataforma elevatória, guindauto,
--      linha de vida...). Ficam num catálogo em Configurar Preços e, em cada
--      orçamento, basta marcar o que a obra inclui:
--        - marcado     → entra no custo de execução, no quadro "Itens
--                        Adicionais de Execução" e em "O orçamento contempla";
--        - não marcado → é citado em "Não contemplado".
--
--   2. REMOÇÃO DO ISOLAMENTO EXISTENTE — marcação por trecho, ao lado de
--      "trabalho em altura". Consome tempo de obra (um fator de eficiência
--      próprio, junto dos demais) e, na proposta, tira a remoção de "Não
--      contemplado" e põe em "O orçamento contempla".
--
-- O que muda no banco:
--   - `config_empresa.itens_execucao_padrao` — o catálogo (lista editável).
--   - `config_empresa.eficiencia_remocao`    — o fator da remoção.
--   - `orcamentos.itens_execucao`            — o catálogo como estava em cada
--                                              orçamento (marcados e não).
--   - `itens_orcamento.remocao_isolamento`   — a marcação de cada trecho.
--
-- VALORES INICIAIS — CONFIRA EM "CONFIGURAR PREÇOS → MÃO DE OBRA":
--   - O catálogo nasce com dez itens comuns, todos com PREÇO ZERADO (cada
--     empresa aluga por um valor). Ajuste preços e unidades, apague o que não
--     usa e acrescente o que faltar.
--   - O fator de remoção nasce em 0,80 (um trecho com remoção rende 80% do
--     normal, ou seja, leva 25% mais tempo). Ajuste conforme a sua prática.
--
-- Orçamentos já existentes não mudam: ficam sem o catálogo e as propostas
-- deles continuam com o texto genérico de antes.
--
-- ORDEM: rodar ANTES de publicar o código deste bloco — sem as colunas, salvar
-- um orçamento dá erro. É seguro rodar com a versão atual do site no ar.
--
-- Idempotente — pode rodar mais de uma vez (o catálogo só é preenchido se
-- ainda estiver vazio).
-- ============================================================================

alter table config_empresa add column if not exists eficiencia_remocao numeric(4, 2) not null default 0.80;
alter table config_empresa add column if not exists itens_execucao_padrao jsonb;

alter table orcamentos add column if not exists itens_execucao jsonb;
alter table itens_orcamento add column if not exists remocao_isolamento boolean not null default false;

update config_empresa
   set itens_execucao_padrao = '[
     {"id": "andaime",               "nome": "Andaime",                                   "unidade": "diária", "preco": 0},
     {"id": "plataforma_elevatoria", "nome": "Plataforma elevatória",                     "unidade": "diária", "preco": 0},
     {"id": "guindauto",             "nome": "Guindauto (caminhão munck)",                "unidade": "diária", "preco": 0},
     {"id": "linha_de_vida",         "nome": "Linha de vida",                             "unidade": "un.",    "preco": 0},
     {"id": "sinalizacao_area",      "nome": "Isolamento e sinalização de área",          "unidade": "verba",  "preco": 0},
     {"id": "cacamba_residuos",      "nome": "Caçamba para descarte de resíduos",         "unidade": "un.",    "preco": 0},
     {"id": "gerador",               "nome": "Gerador de energia",                        "unidade": "diária", "preco": 0},
     {"id": "iluminacao",            "nome": "Iluminação provisória",                     "unidade": "diária", "preco": 0},
     {"id": "ventilacao_confinado",  "nome": "Ventilação/exaustão para espaço confinado", "unidade": "diária", "preco": 0},
     {"id": "vigia_confinado",       "nome": "Vigia e resgate para espaço confinado",     "unidade": "diária", "preco": 0}
   ]'::jsonb
 where itens_execucao_padrao is null;

-- ============================================================================
-- VERIFICAÇÃO
--
-- 1) Fator e catálogo (1 linha; 10 itens na primeira vez):
--   select eficiencia_remocao, jsonb_array_length(itens_execucao_padrao) as itens
--     from config_empresa;
--
-- 2) Colunas novas nos orçamentos (2 linhas):
--   select table_name, column_name from information_schema.columns
--    where (table_name = 'orcamentos' and column_name = 'itens_execucao')
--       or (table_name = 'itens_orcamento' and column_name = 'remocao_isolamento');
-- ============================================================================
