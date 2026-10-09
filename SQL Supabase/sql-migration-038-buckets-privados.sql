-- ============================================================================
-- Migração 038 — Buckets de anexos PRIVADOS
-- ============================================================================
-- Até aqui os 8 buckets de arquivos eram públicos: qualquer pessoa com o link
-- abria o arquivo sem estar logada (documentos de funcionários, comprovantes
-- financeiros, anexos de leads...). Esta migração fecha todos eles.
--
-- O que muda:
--   1. Os 8 buckets passam a `public = false` — o link antigo
--      (.../storage/v1/object/public/...) deixa de abrir sozinho.
--   2. Entra uma regra de LEITURA para usuários autenticados em cada bucket —
--      é o que permite ao app gerar o link temporário (ver
--      app/api/arquivo/[...caminho]/route.ts e lib/arquivos.ts).
--
-- As regras de envio (insert) e exclusão (delete) já existentes não mudam
-- aqui; a migração 039 troca as três por regras que consideram o módulo
-- liberado para cada usuário.
--
-- NADA é apagado: nenhum arquivo e nenhuma URL gravada nas tabelas muda.
--
-- ORDEM: rodar DEPOIS de publicar o código que usa /api/arquivo (com a versão
-- antiga do site no ar, os links de anexo param de abrir assim que esta
-- migração rodar).
--
-- Idempotente — pode rodar mais de uma vez.
-- ============================================================================

update storage.buckets
   set public = false
 where id in (
   'propostas-imagens',
   'servicos-anexos',
   'lancamentos-anexos',
   'leads-anexos',
   'parceiros-anexos',
   'fornecedores-anexos',
   'rh-empresa-anexos',
   'rh-funcionarios-anexos'
 );

do $$
declare
  v_bucket text;
  v_policy text;
begin
  foreach v_bucket in array array[
    'propostas-imagens',
    'servicos-anexos',
    'lancamentos-anexos',
    'leads-anexos',
    'parceiros-anexos',
    'fornecedores-anexos',
    'rh-empresa-anexos',
    'rh-funcionarios-anexos'
  ]
  loop
    v_policy := 'authenticated_select_' || replace(v_bucket, '-', '_');
    execute format('drop policy if exists %I on storage.objects', v_policy);
    execute format(
      'create policy %I on storage.objects for select to authenticated using (bucket_id = %L)',
      v_policy, v_bucket
    );
  end loop;
end $$;

-- ============================================================================
-- VERIFICAÇÃO — as 8 linhas devem vir com `public = false`:
--
--   select id, public from storage.buckets order by id;
--
-- E um link antigo de anexo aberto numa janela anônima do navegador deve
-- passar a responder erro (400/404) em vez de abrir o arquivo.
-- ============================================================================
