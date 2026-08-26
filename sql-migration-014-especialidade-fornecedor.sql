-- ============================================================================
-- BR Isolamentos — Migração 014: corrige um equívoco da migração 013 —
-- "especialidade" foi colocada em `parceiros` (mão de obra de instalação);
-- o correto é `fornecedores` (materiais/equipamentos/serviços de apoio).
--
-- Pré-requisito: sql-migration-013-operacional-multiplos-parceiros.sql já
-- aplicado. Idempotente.
--
-- DECISÕES DE PROJETO (leia antes de aplicar):
--
-- 1) `parceiros.especialidade` é REMOVIDA (não só deixada de usar) — exceção
--    deliberada à regra "nunca apaga coluna": essa coluna foi adicionada HOJE
--    (migração 013, mesma sessão) por engano, sem nenhum parceiro real tendo
--    esse campo preenchido ainda (a tela nem tinha ido ao ar). Diferente de
--    toda outra decisão deste projeto que preserva colunas antigas, aqui não
--    existe dado de verdade em risco — é a correção de um erro recém-
--    cometido, não a evolução de uma feature que já rodou em produção.
--
-- 2) `fornecedores.especialidade` JÁ EXISTIA como texto livre (ver
--    sql-migration-008-operacional-servicos.sql) — essa migração só ADICIONA
--    uma restrição aos 5 valores fixos. Como a coluna já existia e pode (em
--    tese) já ter algum fornecedor cadastrado com um valor livre diferente
--    desses 5, a constraint é criada com `not valid`: passa a valer pra
--    INSERTs/UPDATEs novos, mas não quebra a migração se já existir uma linha
--    com valor fora do padrão (ela só ficaria "sem validar" até ser
--    editada de novo pela UI, que já força um dos 5 valores).
-- ============================================================================

alter table parceiros drop constraint if exists parceiros_especialidade_check;
alter table parceiros drop column if exists especialidade;

alter table fornecedores drop constraint if exists fornecedores_especialidade_check;
alter table fornecedores add constraint fornecedores_especialidade_check
  check (especialidade is null or especialidade in ('isolantes', 'chaparia', 'ferramentas', 'ferragens', 'outros'))
  not valid;

-- ============================================================================
-- Como aplicar: cole este arquivo inteiro no SQL Editor do Supabase e rode.
--
-- Verificação rápida:
--   select column_name from information_schema.columns where table_name = 'parceiros' and column_name = 'especialidade'; -- deve vir vazio
--   select especialidade from fornecedores limit 5;
-- ============================================================================
