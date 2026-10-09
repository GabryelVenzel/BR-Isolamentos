-- ============================================================================
-- BR Isolamentos — Migração 035: Remove o UNIQUE de custos_fixos.categoria.
--
-- Pré-requisito: sql-migration-034-contato-tecnico-proposta.sql já aplicado.
-- 100% aditiva (só remove uma constraint) e idempotente.
--
-- Bug relatado: ao cadastrar um 2º Custo Fixo qualquer, aparecia "Já existe
-- um registro com esse mesmo valor" (erro 23505 do Postgres).
--
-- Causa: `categoria` nasceu UNIQUE na migração 004 (sql-migration-004-
-- 6modulos-completo.sql), quando cada LINHA de custos_fixos representava uma
-- categoria diferente (Aluguel, Energia, Internet...) e a coluna era, ela
-- própria, o identificador de cada custo. O modelo mudou desde então (ver
-- components/modules/financeiro/ModalCustoFixo.tsx): hoje `descricao` é o
-- texto livre que identifica cada custo (ex.: "IA Claude", "Aluguel"), e
-- `categoria` é um rótulo FIXO e IGUAL para todo mundo ("Custo fixo") — a
-- constraint antiga nunca foi removida quando o modelo mudou, então o 2º
-- registro cadastrado (qualquer um, não importa a descrição) sempre colidia
-- com o 1º por terem a mesma `categoria`.
-- ============================================================================

alter table custos_fixos drop constraint if exists custos_fixos_categoria_key;

-- ============================================================================
-- Como aplicar: cole este arquivo inteiro no SQL Editor do Supabase e rode.
-- ============================================================================
