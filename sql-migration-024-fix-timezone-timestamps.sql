-- ============================================================================
-- BR Isolamentos — Migração 024: corrige o fuso horário dos timestamps
-- criados na migração 004 (bug relatado: horário de uma interação de lead
-- não bate com o horário de Brasília).
--
-- Pré-requisito: sql-migration-023-quantificacao-isolante-precisa.sql já
-- aplicado. NÃO é 100% idempotente feature-wise (reescreve valores de
-- coluna existentes) mas rodar 2x não causa dano — a segunda vez só troca
-- timestamptz por timestamptz, sem deslocar o valor de novo.
--
-- DIAGNÓSTICO (leia antes de aplicar):
--
-- A migração 004 criou `leads`, `interacoes_lead`, `parceiros`,
-- `agendamentos`, `lancamentos_financeiros`, `custos_fixos` e
-- `notas_fiscais` com colunas `timestamp` (SEM fuso horário) — diferente do
-- padrão `timestamptz` usado em todo o resto do schema (inclusive nas
-- tabelas que a própria migração 005 acrescentou pouco depois). Isso já
-- estava documentado no cabeçalho da migração 004 como "uma inconsistência
-- real", com a ressalva de que só viraria problema se a sessão do Postgres
-- não estivesse no fuso America/Sao_Paulo — e o Supabase, por padrão, roda
-- a sessão do banco em UTC (não em America/Sao_Paulo), então:
--   • `current_timestamp` (usado como DEFAULT dessas colunas) grava a hora
--     UTC, sem nenhuma informação de fuso junto.
--   • O Supabase devolve esse valor pro navegador como uma string "solta"
--     (ex.: "2026-01-01T13:00:00", sem "Z" nem offset).
--   • O JavaScript, ao dar `new Date()` nessa string sem fuso, assume que
--     ela já está no fuso do PRÓPRIO NAVEGADOR (Brasília) — só que o valor
--     guardado era UTC, não Brasília. Resultado: a tela mostra a hora 3h
--     ADIANTADA da hora real de Brasília (UTC = Brasília + 3h).
--
-- A correção é a que a própria migração 004 já previa: trocar essas colunas
-- de `timestamp` para `timestamptz`, reinterpretando os valores já
-- guardados como UTC (`at time zone 'UTC'`) — depois disso o Postgres passa
-- a devolver a data com o fuso explícito, e `lib/format.ts` (que já força
-- `timeZone: "America/Sao_Paulo"` no Intl.DateTimeFormat) exibe certo sem
-- precisar de nenhuma mudança de código.
--
-- ⚠ VERIFIQUE ANTES DE APLICAR: esta correção assume que a sessão do seu
-- banco Supabase está em UTC (o padrão de fábrica, e o que os outros
-- indícios do projeto sugerem). Rode a consulta abaixo primeiro — se
-- `created_at` de um lead criado há poucos minutos estiver ~3h ATRASADO em
-- relação ao horário de Brasília agora, confirma o diagnóstico. Se já
-- estiver batendo com o horário de Brasília, NÃO aplique esta migração
-- (avise pra revisarmos de outro jeito):
--
--   select created_at, now() as agora_utc,
--          now() at time zone 'America/Sao_Paulo' as agora_brasilia
--   from leads order by created_at desc limit 3;
--
-- ⚠ CORREÇÃO APÓS 1ª TENTATIVA: a primeira versão deste arquivo falhava com
-- "cannot alter type of a column used by a view or rule" — duas views
-- (`v_leads_por_etapa`, migração 004, e `v_clientes_resumo`, migração 005)
-- dependem de `leads.created_at`/`updated_at` e `interacoes_lead.
-- data_interacao`. Postgres não deixa alterar o tipo de uma coluna que uma
-- view usa enquanto a view existir — a saída padrão é derrubar a view,
-- alterar a coluna, e recriar a view idêntica na sequência (é o que este
-- arquivo faz agora). As outras duas views do projeto (`v_capacidade_
-- parceiros`, `v_financeiro_mes_atual`) não referenciam nenhuma das colunas
-- alteradas aqui, então não precisam ser tocadas.
-- ============================================================================

-- Derruba as views que dependem das colunas sendo alteradas (recriadas mais
-- abaixo, com a MESMA definição das migrações 004/005 — só a coluna por
-- baixo muda de tipo, a view continua igual).
drop view if exists v_leads_por_etapa;
drop view if exists v_clientes_resumo;

alter table leads alter column created_at type timestamptz using created_at at time zone 'UTC';
alter table leads alter column updated_at type timestamptz using updated_at at time zone 'UTC';

alter table interacoes_lead alter column data_interacao type timestamptz using data_interacao at time zone 'UTC';
alter table interacoes_lead alter column created_at type timestamptz using created_at at time zone 'UTC';

alter table parceiros alter column created_at type timestamptz using created_at at time zone 'UTC';
alter table parceiros alter column updated_at type timestamptz using updated_at at time zone 'UTC';

alter table agendamentos alter column created_at type timestamptz using created_at at time zone 'UTC';
alter table agendamentos alter column updated_at type timestamptz using updated_at at time zone 'UTC';

alter table lancamentos_financeiros alter column created_at type timestamptz using created_at at time zone 'UTC';
alter table lancamentos_financeiros alter column updated_at type timestamptz using updated_at at time zone 'UTC';

alter table custos_fixos alter column created_at type timestamptz using created_at at time zone 'UTC';
alter table custos_fixos alter column updated_at type timestamptz using updated_at at time zone 'UTC';

alter table notas_fiscais alter column created_at type timestamptz using created_at at time zone 'UTC';

-- Os DEFAULTs (`current_timestamp`) continuam funcionando sem alteração —
-- `current_timestamp` já devolve um valor com fuso (timestamptz); atribuir
-- isso a uma coluna que agora também é timestamptz não precisa de cast.
-- O trigger `set_updated_at()` (mesma migração 004) também não precisa
-- mudar, pelo mesmo motivo.

-- Recria as duas views derrubadas acima — definição idêntica à original
-- (sql-migration-004-6modulos-completo.sql / sql-migration-005-crm-avancado.sql).
create view v_leads_por_etapa as
select
  etapa,
  count(*) as total,
  coalesce(sum(valor_estimado), 0) as valor_total,
  round(avg(extract(epoch from (current_timestamp - created_at)) / 86400)::numeric, 1) as dias_medio
from leads
group by etapa;

create view v_clientes_resumo as
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
  greatest(max(l.updated_at), max(i.data_interacao)) as ultima_interacao
from clientes c
left join leads l on l.cliente_id = c.id
left join interacoes_lead i on i.lead_id = l.id
group by c.id;

-- ============================================================================
-- Como aplicar: cole este arquivo inteiro no SQL Editor do Supabase e rode
-- (depois de conferir o diagnóstico acima).
--
-- Verificação rápida:
--   select created_at, updated_at from leads order by created_at desc limit 3;
--   -- os dois devem vir com offset (ex.: "+00:00") em vez de "solto".
--   -- na tela (Comercial → detalhe do lead → Interações), o horário exibido
--   -- deve bater com o relógio de Brasília no momento em que a interação
--   -- foi registrada.
--
--   select * from v_leads_por_etapa;
--   select * from v_clientes_resumo limit 3;
--   -- as duas views devem continuar devolvendo dado normalmente.
-- ============================================================================
