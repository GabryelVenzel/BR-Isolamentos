-- ============================================================================
-- Migração 047 — Lixeira para leads, orçamentos, clientes e lançamentos
-- ============================================================================
-- A migração 045 criou a lixeira dos serviços. Esta estende a mesma regra aos
-- outros registros que hoje são apagados na hora, sem volta:
--
--   leads · orçamentos · clientes · lançamentos financeiros
--
-- O que muda:
--   1. `excluido_em` / `excluido_por` nas quatro tabelas — "Excluir" passa a
--      só marcar o registro (vai para a LIXEIRA): ele some das telas, das
--      somas e dos relatórios, mas continua no banco com tudo o que depende
--      dele (histórico e interações do lead, itens do orçamento, comprovantes
--      do lançamento...). Da lixeira o administrador pode RESTAURAR ou EXCLUIR
--      DEFINITIVAMENTE; o que ficar 30 dias lá é removido pela rotina diária.
--   2. As três visões de resumo deixam de contar o que está na lixeira:
--      `v_leads_por_etapa`, `v_clientes_resumo` e `v_financeiro_mes_atual`.
--   3. Regra de acesso: APAGAR de verdade (delete) nessas quatro tabelas passa
--      a ser só de administrador. Ler, criar e alterar continuam como estão
--      (mandar para a lixeira é uma alteração, então quem excluía continua
--      podendo excluir).
--
-- NADA é apagado por esta migração.
--
-- ORDEM: rodar ANTES de publicar o código deste bloco — as telas passam a
-- filtrar por `excluido_em` e dariam erro sem as colunas. É seguro rodar com a
-- versão atual do site no ar, com uma ressalva: entre rodar este arquivo e a
-- publicação do código novo, o botão "Excluir" de leads, orçamentos, clientes
-- e lançamentos só funciona para administradores (para os demais o banco
-- ignora a exclusão). Depende das migrações 039 e 045.
--
-- Idempotente — pode rodar mais de uma vez.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Colunas da lixeira
-- ----------------------------------------------------------------------------
alter table leads add column if not exists excluido_em timestamptz;
alter table leads add column if not exists excluido_por varchar;

alter table orcamentos add column if not exists excluido_em timestamptz;
alter table orcamentos add column if not exists excluido_por varchar;

alter table clientes add column if not exists excluido_em timestamptz;
alter table clientes add column if not exists excluido_por varchar;

alter table lancamentos_financeiros add column if not exists excluido_em timestamptz;
alter table lancamentos_financeiros add column if not exists excluido_por varchar;

create index if not exists idx_leads_excluido_em on leads (excluido_em) where excluido_em is not null;
create index if not exists idx_orcamentos_excluido_em on orcamentos (excluido_em) where excluido_em is not null;
create index if not exists idx_clientes_excluido_em on clientes (excluido_em) where excluido_em is not null;
create index if not exists idx_lancamentos_excluido_em on lancamentos_financeiros (excluido_em) where excluido_em is not null;

-- ----------------------------------------------------------------------------
-- 2. Visões de resumo: ignoram o que está na lixeira
--    (mesmas colunas de antes — só entram os filtros de `excluido_em`)
-- ----------------------------------------------------------------------------
create or replace view v_leads_por_etapa
with (security_invoker = true) as
select
  etapa,
  count(*) as total,
  coalesce(sum(valor_estimado), 0) as valor_total,
  round(avg(extract(epoch from (current_timestamp - created_at)) / 86400)::numeric, 1) as dias_medio
from leads
where excluido_em is null
group by etapa;

create or replace view v_clientes_resumo
with (security_invoker = true) as
select
  c.id,
  c.nome,
  c.telefone,
  c.email,
  c.endereco,
  c.cidade,
  c.estado,
  c.cnpj_cpf,
  c.criado_em,
  count(distinct l.id) as total_leads,
  greatest(max(l.updated_at), max(i.data_interacao)) as ultima_interacao,
  c.razao_social,
  c.cep
from clientes c
left join leads l on l.cliente_id = c.id and l.excluido_em is null
left join interacoes_lead i on i.lead_id = l.id
where c.excluido_em is null
group by c.id;

create or replace view v_financeiro_mes_atual
with (security_invoker = true) as
select
  to_char(current_date, 'YYYY-MM') as mes,
  coalesce(sum(lf.valor) filter (where lf.tipo = 'receita'), 0) as receita_total,
  coalesce(sum(lf.valor) filter (where lf.tipo = 'despesa'), 0) as despesa_total,
  coalesce(sum(lf.valor) filter (where lf.tipo = 'receita'), 0)
    - coalesce(sum(lf.valor) filter (where lf.tipo = 'despesa'), 0) as lucro_bruto,
  (
    select count(*)
    from orcamentos o
    where date_trunc('month', o.data_criacao) = date_trunc('month', current_date)
      and o.excluido_em is null
  ) as numero_orcamentos
from lancamentos_financeiros lf
where date_trunc('month', lf.data) = date_trunc('month', current_date)
  and lf.excluido_em is null;

-- ----------------------------------------------------------------------------
-- 3. Apagar de verdade: só administrador
-- ----------------------------------------------------------------------------
-- 3.1 Leads, orçamentos e clientes — hoje têm uma regra única
--     ("acesso_ativo_<tabela>", migração 039) que vira quatro, uma por operação.
do $$
declare
  v_tabela text;
begin
  foreach v_tabela in array array['leads', 'orcamentos', 'clientes']
  loop
    execute format('drop policy if exists %I on %I', 'acesso_ativo_' || v_tabela, v_tabela);

    execute format('drop policy if exists %I on %I', 'acesso_' || v_tabela || '_leitura', v_tabela);
    execute format(
      'create policy %I on %I for select to authenticated using (public.usuario_ativo())',
      'acesso_' || v_tabela || '_leitura', v_tabela
    );

    execute format('drop policy if exists %I on %I', 'acesso_' || v_tabela || '_inclusao', v_tabela);
    execute format(
      'create policy %I on %I for insert to authenticated with check (public.usuario_ativo())',
      'acesso_' || v_tabela || '_inclusao', v_tabela
    );

    execute format('drop policy if exists %I on %I', 'acesso_' || v_tabela || '_alteracao', v_tabela);
    execute format(
      'create policy %I on %I for update to authenticated using (public.usuario_ativo()) with check (public.usuario_ativo())',
      'acesso_' || v_tabela || '_alteracao', v_tabela
    );

    execute format('drop policy if exists %I on %I', 'acesso_' || v_tabela || '_exclusao', v_tabela);
    execute format(
      'create policy %I on %I for delete to authenticated using (public.usuario_admin())',
      'acesso_' || v_tabela || '_exclusao', v_tabela
    );
  end loop;
end $$;

-- 3.2 Lançamentos — já tinham regras separadas (migração 039); só a de
--     exclusão muda, de "módulo Financeiro" para "administrador".
drop policy if exists "acesso_lancamentos_exclusao" on lancamentos_financeiros;
create policy "acesso_lancamentos_exclusao" on lancamentos_financeiros
  for delete to authenticated
  using (public.usuario_admin());

-- ============================================================================
-- VERIFICAÇÃO
--
-- 1) Colunas novas (4 linhas, uma por tabela):
--   select table_name from information_schema.columns
--    where column_name = 'excluido_em'
--      and table_name in ('leads', 'orcamentos', 'clientes', 'lancamentos_financeiros')
--    order by 1;
--
-- 2) Regras de exclusão (4 linhas, todas com usuario_admin):
--   select tablename, policyname, qual from pg_policies
--    where cmd = 'DELETE'
--      and tablename in ('leads', 'orcamentos', 'clientes', 'lancamentos_financeiros')
--    order by 1;
--
-- 3) As visões continuam respondendo:
--   select * from v_leads_por_etapa;
--   select * from v_financeiro_mes_atual;
--   select id, nome, total_leads from v_clientes_resumo limit 5;
-- ============================================================================
