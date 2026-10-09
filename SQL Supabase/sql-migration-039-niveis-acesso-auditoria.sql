-- ============================================================================
-- Migração 039 — Níveis de acesso por módulo + registro de alterações
-- ============================================================================
-- Até aqui toda tabela tinha uma regra única "qualquer usuário autenticado
-- pode tudo" e não havia registro de quem alterou o quê. Esta migração:
--
--   1. Adiciona `usuarios.modulos` (módulos liberados para cada usuário —
--      `role = 'admin'` continua significando "acessa tudo").
--   2. Cria as funções `usuario_ativo()`, `usuario_admin()` e `tem_modulo()`
--      usadas pelas regras de acesso.
--   3. Troca as regras de acesso de TODAS as tabelas:
--        - qualquer tabela: exige usuário cadastrado em `usuarios` e ATIVO
--          (desativar alguém em RH → Usuários corta o acesso ao banco na hora);
--        - RH (funcionários e documentos): exige o módulo RH;
--        - Financeiro (custos fixos, histórico, configuração, notas): exige o
--          módulo Financeiro (leitura também para quem tem Resumo, que mostra
--          os indicadores financeiros);
--        - Lançamentos: Financeiro/Resumo, e também o lançamento ligado a um
--          serviço (para Operacional) ou a um lead (para Comercial) — é o que
--          permite "finalizar serviço" e "fechar lead de comissão" gerarem a
--          receita automática sem dar acesso ao financeiro inteiro;
--        - `usuarios`: todos os ativos leem (dropdowns de responsável), só
--          administrador grava;
--        - `auditoria`: só administrador lê, ninguém grava direto.
--      Os demais módulos (Comercial, Operacional, Orçamento, Engenharia) são
--      separados pelo app (menu, páginas e APIs — ver lib/acesso.ts), não por
--      regra de banco, porque as telas deles se cruzam.
--   4. Faz as 4 views respeitarem as regras de quem consulta
--      (`security_invoker`) — antes elas liam com o privilégio do dono.
--   5. Troca as regras dos buckets de anexos (migração 038) para as mesmas
--      condições: RH e Financeiro exigem o módulo, os demais exigem usuário
--      ativo.
--   6. Cria a tabela `auditoria` e um gatilho nas tabelas de negócio que
--      registra inclusão, alteração (só os campos que mudaram) e exclusão,
--      com o e-mail de quem fez.
--
-- NADA é apagado: só regras de acesso são substituídas.
--
-- PRÉ-REQUISITO (a migração se recusa a rodar sem isso): existir pelo menos
-- um usuário `role = 'admin'`, ativo, com e-mail @br-isolamentos.com.br e
-- login criado no Supabase Auth — senão ninguém conseguiria mais gerenciar
-- o sistema depois que as regras entrarem.
--
-- Idempotente — pode rodar mais de uma vez.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Trava de segurança
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
      from usuarios u
      join auth.users a on lower(a.email) = lower(u.email)
     where u.role = 'admin'
       and u.ativo
       and lower(u.email) like '%@br-isolamentos.com.br'
  ) then
    raise exception 'Migração 039 interrompida: nenhum administrador ativo @br-isolamentos.com.br com login. Crie a conta de administrador antes de rodar.';
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 1. usuarios.modulos
-- ----------------------------------------------------------------------------
alter table usuarios add column if not exists modulos text[] not null default '{}';

alter table usuarios drop constraint if exists usuarios_modulos_validos;
alter table usuarios add constraint usuarios_modulos_validos
  check (modulos <@ array['resumo', 'engenharia', 'comercial', 'operacional', 'orcamento', 'financeiro', 'rh']::text[]);

-- ----------------------------------------------------------------------------
-- 2. Funções de acesso
-- ----------------------------------------------------------------------------
-- `security definer`: leem `usuarios` com o privilégio do dono, senão a
-- própria regra de `usuarios` chamaria a função que lê `usuarios` (recursão).
-- O e-mail vem do token da sessão — o usuário não consegue forjá-lo.

create or replace function public.usuario_ativo()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from usuarios u
     where lower(u.email) = lower(auth.jwt() ->> 'email')
       and u.ativo
  );
$$;

create or replace function public.usuario_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from usuarios u
     where lower(u.email) = lower(auth.jwt() ->> 'email')
       and u.ativo
       and u.role = 'admin'
  );
$$;

-- tem_modulo('financeiro', 'resumo') = ativo E (admin OU tem algum dos módulos).
create or replace function public.tem_modulo(variadic p_modulos text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from usuarios u
     where lower(u.email) = lower(auth.jwt() ->> 'email')
       and u.ativo
       and (u.role = 'admin' or u.modulos && p_modulos)
  );
$$;

revoke all on function public.usuario_ativo() from public;
revoke all on function public.usuario_admin() from public;
revoke all on function public.tem_modulo(text[]) from public;
grant execute on function public.usuario_ativo() to authenticated;
grant execute on function public.usuario_admin() to authenticated;
grant execute on function public.tem_modulo(text[]) to authenticated;

-- ----------------------------------------------------------------------------
-- 3. Tabela de auditoria (antes das regras, que também a cobrem)
-- ----------------------------------------------------------------------------
create table if not exists auditoria (
  id bigint generated always as identity primary key,
  data timestamptz not null default now(),
  usuario_email text,
  acao text not null check (acao in ('inclusao', 'alteracao', 'exclusao')),
  tabela text not null,
  registro_id text,
  registro_rotulo text,
  detalhes jsonb not null default '{}'::jsonb
);

create index if not exists idx_auditoria_data on auditoria (data desc);
create index if not exists idx_auditoria_tabela on auditoria (tabela);
create index if not exists idx_auditoria_usuario_email on auditoria (usuario_email);

alter table auditoria enable row level security;

-- ----------------------------------------------------------------------------
-- 4. Regras de acesso das tabelas
-- ----------------------------------------------------------------------------
do $$
declare
  v_tabela text;
  v_policy record;
  -- Tabelas com regra própria (tratadas uma a uma mais abaixo).
  v_especiais text[] := array[
    'usuarios', 'auditoria',
    'funcionarios', 'funcionario_anexos', 'documentos_empresa',
    'custos_fixos', 'historico_custos_fixos', 'config_financeiro', 'notas_fiscais',
    'lancamentos_financeiros'
  ];
begin
  -- 4.1 Remove TODAS as regras atuais das tabelas do schema public.
  for v_policy in
    select schemaname, tablename, policyname from pg_policies where schemaname = 'public'
  loop
    execute format('drop policy if exists %I on %I.%I', v_policy.policyname, v_policy.schemaname, v_policy.tablename);
  end loop;

  -- 4.2 Regra padrão: usuário cadastrado e ativo.
  for v_tabela in
    select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind = 'r'
       and c.relname <> all (v_especiais)
  loop
    execute format('alter table %I enable row level security', v_tabela);
    execute format(
      'create policy %I on %I for all to authenticated using (public.usuario_ativo()) with check (public.usuario_ativo())',
      'acesso_ativo_' || v_tabela, v_tabela
    );
  end loop;

  -- 4.3 RH: exige o módulo RH.
  foreach v_tabela in array array['funcionarios', 'funcionario_anexos', 'documentos_empresa']
  loop
    if to_regclass('public.' || v_tabela) is not null then
      execute format('alter table %I enable row level security', v_tabela);
      execute format(
        'create policy %I on %I for all to authenticated using (public.tem_modulo(''rh'')) with check (public.tem_modulo(''rh''))',
        'acesso_rh_' || v_tabela, v_tabela
      );
    end if;
  end loop;

  -- 4.4 Financeiro: leitura para Financeiro e Resumo, gravação só Financeiro.
  foreach v_tabela in array array['custos_fixos', 'historico_custos_fixos', 'config_financeiro', 'notas_fiscais']
  loop
    if to_regclass('public.' || v_tabela) is not null then
      execute format('alter table %I enable row level security', v_tabela);
      execute format(
        'create policy %I on %I for select to authenticated using (public.tem_modulo(''financeiro'', ''resumo''))',
        'acesso_fin_leitura_' || v_tabela, v_tabela
      );
      execute format(
        'create policy %I on %I for insert to authenticated with check (public.tem_modulo(''financeiro''))',
        'acesso_fin_inclusao_' || v_tabela, v_tabela
      );
      execute format(
        'create policy %I on %I for update to authenticated using (public.tem_modulo(''financeiro'')) with check (public.tem_modulo(''financeiro''))',
        'acesso_fin_alteracao_' || v_tabela, v_tabela
      );
      execute format(
        'create policy %I on %I for delete to authenticated using (public.tem_modulo(''financeiro''))',
        'acesso_fin_exclusao_' || v_tabela, v_tabela
      );
    end if;
  end loop;
end $$;

-- 4.5 Lançamentos financeiros.
create policy "acesso_lancamentos_leitura" on lancamentos_financeiros
  for select to authenticated
  using (
    public.tem_modulo('financeiro', 'resumo')
    or (servico_id is not null and public.tem_modulo('operacional'))
    or (lead_id is not null and public.tem_modulo('comercial'))
  );

create policy "acesso_lancamentos_inclusao" on lancamentos_financeiros
  for insert to authenticated
  with check (
    public.tem_modulo('financeiro')
    or (servico_id is not null and public.tem_modulo('operacional'))
    or (lead_id is not null and public.tem_modulo('comercial'))
  );

create policy "acesso_lancamentos_alteracao" on lancamentos_financeiros
  for update to authenticated
  using (public.tem_modulo('financeiro'))
  with check (public.tem_modulo('financeiro'));

create policy "acesso_lancamentos_exclusao" on lancamentos_financeiros
  for delete to authenticated
  using (public.tem_modulo('financeiro'));

-- 4.6 Usuários: ativos leem, só administrador grava.
create policy "acesso_usuarios_leitura" on usuarios
  for select to authenticated
  using (public.usuario_ativo());

create policy "acesso_usuarios_inclusao" on usuarios
  for insert to authenticated
  with check (public.usuario_admin());

create policy "acesso_usuarios_alteracao" on usuarios
  for update to authenticated
  using (public.usuario_admin())
  with check (public.usuario_admin());

create policy "acesso_usuarios_exclusao" on usuarios
  for delete to authenticated
  using (public.usuario_admin());

-- 4.7 Auditoria: só administrador lê. Sem regra de insert/update/delete —
-- quem grava é o gatilho (security definer), ninguém altera nem apaga.
create policy "acesso_auditoria_leitura" on auditoria
  for select to authenticated
  using (public.usuario_admin());

-- ----------------------------------------------------------------------------
-- 5. Views passam a respeitar as regras de quem consulta
-- ----------------------------------------------------------------------------
do $$
declare
  v_view text;
begin
  foreach v_view in array array['v_capacidade_parceiros', 'v_clientes_resumo', 'v_financeiro_mes_atual', 'v_leads_por_etapa']
  loop
    if to_regclass('public.' || v_view) is not null then
      execute format('alter view %I set (security_invoker = true)', v_view);
    end if;
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 6. Regras dos buckets de anexos
-- ----------------------------------------------------------------------------
do $$
declare
  v_bucket text;
  v_sufixo text;
  v_condicao text;
  v_operacao text;
begin
  foreach v_bucket in array array[
    'propostas-imagens', 'servicos-anexos', 'lancamentos-anexos', 'leads-anexos',
    'parceiros-anexos', 'fornecedores-anexos', 'rh-empresa-anexos', 'rh-funcionarios-anexos'
  ]
  loop
    v_sufixo := replace(v_bucket, '-', '_');
    v_condicao := case
      when v_bucket in ('rh-empresa-anexos', 'rh-funcionarios-anexos') then 'public.tem_modulo(''rh'')'
      when v_bucket = 'lancamentos-anexos' then 'public.tem_modulo(''financeiro'')'
      else 'public.usuario_ativo()'
    end;

    -- Regras antigas (schema inicial, migrações 002–033 e 038).
    foreach v_operacao in array array['select', 'insert', 'delete']
    loop
      execute format('drop policy if exists %I on storage.objects', 'authenticated_' || v_operacao || '_' || v_sufixo);
      execute format('drop policy if exists %I on storage.objects', 'acesso_' || v_operacao || '_' || v_sufixo);
    end loop;

    execute format(
      'create policy %I on storage.objects for select to authenticated using (bucket_id = %L and %s)',
      'acesso_select_' || v_sufixo, v_bucket, v_condicao
    );
    execute format(
      'create policy %I on storage.objects for insert to authenticated with check (bucket_id = %L and %s)',
      'acesso_insert_' || v_sufixo, v_bucket, v_condicao
    );
    execute format(
      'create policy %I on storage.objects for delete to authenticated using (bucket_id = %L and %s)',
      'acesso_delete_' || v_sufixo, v_bucket, v_condicao
    );
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 7. Gatilho de auditoria
-- ----------------------------------------------------------------------------
create or replace function public.registrar_auditoria()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_acao text;
  v_antes jsonb;
  v_depois jsonb;
  v_referencia jsonb;
  v_detalhes jsonb;
begin
  if tg_op = 'INSERT' then
    v_acao := 'inclusao';
    v_depois := to_jsonb(new);
    v_referencia := v_depois;
    v_detalhes := v_depois;
  elsif tg_op = 'DELETE' then
    v_acao := 'exclusao';
    v_antes := to_jsonb(old);
    v_referencia := v_antes;
    v_detalhes := v_antes;
  else
    v_acao := 'alteracao';
    v_antes := to_jsonb(old);
    v_depois := to_jsonb(new);
    v_referencia := v_depois;

    -- Só os campos que de fato mudaram, como { campo: { de, para } }.
    select coalesce(jsonb_object_agg(d.key, jsonb_build_object('de', v_antes -> d.key, 'para', d.value)), '{}'::jsonb)
      into v_detalhes
      from jsonb_each(v_depois) d
     where d.value is distinct from (v_antes -> d.key)
       and d.key not in ('updated_at', 'atualizado_em');

    -- "Salvar" sem mudar nada não gera registro.
    if v_detalhes = '{}'::jsonb then
      return new;
    end if;
  end if;

  insert into auditoria (usuario_email, acao, tabela, registro_id, registro_rotulo, detalhes)
  values (
    nullif(lower(auth.jwt() ->> 'email'), ''),
    v_acao,
    tg_table_name,
    v_referencia ->> 'id',
    coalesce(
      v_referencia ->> 'numero',
      v_referencia ->> 'numero_lead',
      v_referencia ->> 'numero_servico',
      v_referencia ->> 'nome',
      v_referencia ->> 'descricao',
      v_referencia ->> 'nome_arquivo',
      v_referencia ->> 'email'
    ),
    v_detalhes
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- Tabelas auditadas. Ficam de fora, de propósito: as que já são um histórico
-- (historico_*, interacoes_*, agendamentos_leads_frios), os itens de
-- orçamento (regravados em bloco a cada edição — a alteração aparece no
-- próprio orçamento) e os catálogos físicos de materiais.
do $$
declare
  v_tabela text;
begin
  foreach v_tabela in array array[
    'usuarios', 'clientes', 'leads', 'orcamentos',
    'servicos', 'servico_parceiros_execucao', 'parceiros', 'fornecedores',
    'lancamentos_financeiros', 'custos_fixos', 'categorias_lancamentos',
    'funcionarios', 'funcionario_anexos', 'documentos_empresa',
    'anexos_lead', 'parceiro_anexos', 'fornecedor_anexos',
    'precos_config', 'impostos_config', 'config_empresa', 'config_financeiro',
    'config_prazo_etapas', 'config_reativacao_leads_frios'
  ]
  loop
    if to_regclass('public.' || v_tabela) is not null then
      execute format('drop trigger if exists trg_auditoria on %I', v_tabela);
      execute format(
        'create trigger trg_auditoria after insert or update or delete on %I for each row execute function public.registrar_auditoria()',
        v_tabela
      );
    end if;
  end loop;
end $$;

-- ============================================================================
-- VERIFICAÇÃO
--
-- 1) Toda tabela com regra nova (nenhuma linha deve ter `using (true)`):
--   select tablename, policyname, cmd, qual from pg_policies
--    where schemaname = 'public' order by tablename, policyname;
--
-- 2) Gatilhos de auditoria criados (23 linhas):
--   select event_object_table from information_schema.triggers
--    where trigger_name = 'trg_auditoria' group by 1 order by 1;
--
-- 3) Depois de editar qualquer cadastro pelo sistema:
--   select data, usuario_email, acao, tabela, registro_rotulo, detalhes
--     from auditoria order by id desc limit 10;
-- ============================================================================
