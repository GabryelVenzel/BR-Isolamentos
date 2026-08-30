-- ============================================================================
-- BR Isolamentos — Migração 031: Razão Social em Clientes, Parceiros e
-- Fornecedores.
--
-- Pré-requisito: sql-migration-030-notas-tipos-trabalho.sql já aplicado.
-- 100% aditiva e idempotente.
--
-- DECISÃO DE PROJETO: `clientes.nome`/`parceiros.nome` NÃO são renomeados
-- pra `nome_fantasia` — as duas colunas são lidas em dezenas de lugares
-- (cards do Kanban, dropdowns de busca, cabeçalho das Propostas, docx,
-- relatórios financeiros...) e uma migração de nome quebraria tudo isso de
-- uma vez sem ganho real. Em vez disso, `nome` PASSA A REPRESENTAR
-- comercialmente o Nome Fantasia (é exatamente o que já era usado pra: o
-- nome pelo qual a empresa/cliente é chamado no dia a dia) — só o RÓTULO na
-- tela de cadastro muda pra "Nome Fantasia", a coluna continua `nome`.
-- `razao_social` entra como coluna nova, opcional (nem todo cliente é
-- pessoa jurídica — `cnpj_cpf` já aceita os dois, `razao_social` só faz
-- sentido pra quem tem CNPJ, mas não é validado contra isso).
-- ============================================================================

alter table clientes add column if not exists razao_social varchar;
alter table parceiros add column if not exists razao_social varchar;
alter table fornecedores add column if not exists razao_social varchar;

-- ============================================================================
-- Como aplicar: cole este arquivo inteiro no SQL Editor do Supabase e rode.
-- ============================================================================
