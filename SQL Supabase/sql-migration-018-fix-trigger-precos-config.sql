-- ============================================================================
-- BR Isolamentos — Migração 018: corrige o trigger de `precos_config`, que
-- quebra QUALQUER update na tabela (achado ao rodar a migração 017).
--
-- Pré-requisito: nenhum além do schema base (sql-schema.sql) — este bug é
-- anterior a esta sessão, só nunca tinha sido exercitado antes.
--
-- CAUSA RAIZ (bug do schema original, não desta sessão): `precos_config` usa
-- a coluna `ultima_atualizacao` (ver sql-schema.sql linha 169), mas o
-- trigger `trg_precos_config_atualizado_em` chama a função genérica
-- `set_atualizado_em()`, que tenta gravar em `NEW.atualizado_em` — coluna
-- que não existe em `precos_config` (só existe em `orcamentos`, a tabela
-- pra qual essa função foi escrita originalmente). Resultado: TODO update
-- em `precos_config` — incluindo o botão "Salvar preços" da tela Configurar
-- Preços, e as próprias migrações 016/017 — falha com
-- `record "new" has no field "atualizado_em"`.
--
-- FIX: função dedicada `set_ultima_atualizacao()`, que grava na coluna
-- certa; o trigger passa a chamar ela em vez da genérica.
-- ============================================================================

create or replace function set_ultima_atualizacao()
returns trigger as $$
begin
  new.ultima_atualizacao = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_precos_config_atualizado_em on precos_config;
create trigger trg_precos_config_atualizado_em
  before update on precos_config
  for each row execute function set_ultima_atualizacao();


-- ============================================================================
-- Como aplicar: cole este arquivo inteiro no SQL Editor do Supabase e rode
-- ANTES de rodar (ou re-rodar) a migração 017 — o erro que você teve
-- aconteceu bem no meio dela, então rode esta 018 primeiro e depois rode a
-- 017 de novo (ela é idempotente, segura rodar de novo do zero).
--
-- Verificação rápida:
--   update precos_config set ativo = ativo where id = (select id from precos_config limit 1);
--   -- não deve mais dar erro.
-- ============================================================================
