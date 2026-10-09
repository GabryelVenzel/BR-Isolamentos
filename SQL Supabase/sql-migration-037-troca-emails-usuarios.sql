-- ============================================================================
-- Migração 037 — Troca dos e-mails dos usuários para @br-isolamentos.com.br
-- ============================================================================
-- O login passa a aceitar só e-mails @br-isolamentos.com.br. Os três usuários
-- cadastrados hoje usam @gmail.com, e esse e-mail é a "chave" que liga a
-- pessoa ao histórico dela: responsável de lead/orçamento/serviço, autor de
-- interações e de mudanças de etapa, quem anexou cada arquivo.
--
-- O que esta migração faz:
--   1. Recria as chaves estrangeiras que apontam para `usuarios(email)` com
--      ON UPDATE CASCADE — assim, trocar o e-mail em `usuarios` troca junto em
--      todas as tabelas que o referenciam (hoje a troca seria bloqueada).
--   2. Troca os três e-mails:
--        gabryelvenzel@gmail.com    -> gabryel.venzel@br-isolamentos.com.br
--        fabianogarcia@gmail.com    -> fabiano.garcia@br-isolamentos.com.br
--        wesley@gmail.com           -> wesley.henrique@br-isolamentos.com.br
--
-- NADA é apagado. Nome, telefone, papel e todo o histórico continuam os mesmos.
--
-- Esta migração NÃO mexe na conta de login (Supabase Auth) — a conta do
-- Gabryel é atualizada à parte, logo depois (ver ordem de publicação).
--
-- ORDEM: é a PRIMEIRA das três (037 -> 038 -> 039). A 039 se recusa a rodar
-- enquanto não existir um administrador @br-isolamentos.com.br.
--
-- Idempotente — pode rodar mais de uma vez.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Chaves estrangeiras para usuarios(email) passam a propagar a troca
-- ----------------------------------------------------------------------------
do $$
declare
  v_fk record;
begin
  for v_fk in
    select c.oid,
           c.conname,
           c.conrelid::regclass as tabela,
           pg_get_constraintdef(c.oid) as definicao
      from pg_constraint c
     where c.contype = 'f'
       and c.confrelid = 'public.usuarios'::regclass
       and c.confupdtype <> 'c'  -- ainda não é ON UPDATE CASCADE
  loop
    execute format('alter table %s drop constraint %I', v_fk.tabela, v_fk.conname);
    execute format('alter table %s add constraint %I %s on update cascade', v_fk.tabela, v_fk.conname, v_fk.definicao);
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 2. Troca dos e-mails
-- ----------------------------------------------------------------------------
do $$
declare
  v_par text[];
  v_pares text[][] := array[
    array['gabryelvenzel@gmail.com', 'gabryel.venzel@br-isolamentos.com.br'],
    array['fabianogarcia@gmail.com', 'fabiano.garcia@br-isolamentos.com.br'],
    array['wesley@gmail.com',        'wesley.henrique@br-isolamentos.com.br']
  ];
begin
  foreach v_par slice 1 in array v_pares
  loop
    if exists (select 1 from usuarios where lower(email) = v_par[2]) then
      raise notice 'E-mail % já existe em usuarios — nada a fazer para %.', v_par[2], v_par[1];
    else
      update usuarios set email = v_par[2] where lower(email) = v_par[1];
    end if;
  end loop;
end $$;

-- ============================================================================
-- VERIFICAÇÃO
--
-- 1) Os três usuários com o e-mail novo:
--   select nome, email, role, ativo from usuarios order by nome;
--
-- 2) Nenhum registro ficou com e-mail antigo (deve voltar 0 em todas):
--   select 'leads' as onde, count(*) from leads where atribuido_a like '%@gmail.com'
--   union all select 'orcamentos', count(*) from orcamentos where atribuido_a like '%@gmail.com'
--   union all select 'servicos', count(*) from servicos where responsavel_email like '%@gmail.com';
-- ============================================================================
