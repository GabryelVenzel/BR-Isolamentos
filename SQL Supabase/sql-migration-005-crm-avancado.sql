-- ============================================================================
-- BR Isolamentos — Migração 005: CRM avançado (módulo Comercial)
--
-- Pré-requisito: sql-migration-004-6modulos-completo.sql já aplicado (cria
-- `leads`, `interacoes_lead`, a função `set_updated_at()` e o trigger que ela
-- alimenta). Este arquivo só ADICIONA o que falta para o CRM completo:
-- histórico de mudanças de etapa/temperatura, agendamento de reativação de
-- leads frios, prazos de reativação configuráveis, e os campos que faltavam
-- em `clientes` (cidade/estado) para a nova aba "Clientes".
--
-- 100% aditivo e idempotente — mesmas regras do arquivo anterior:
--   • create table/index IF NOT EXISTS
--   • alter table ... add column IF NOT EXISTS
--   • drop view/policy IF EXISTS antes de recriar
--   • insert de seed com ON CONFLICT DO NOTHING
--   • NENHUM DROP TABLE / TRUNCATE / DELETE em tabela com dado de produção
--
-- TIMEZONE: as tabelas novas deste arquivo usam `timestamptz` (com fuso),
-- diferente da convenção `timestamp` (sem fuso) adotada em `leads`/
-- `interacoes_lead` na migração 004. Motivo: o agendamento de reativação de
-- leads frios FAZ contas de data ("agora + N dias") e PRECISA comparar
-- "já venceu?" de forma inequívoca — isso é fundamentalmente diferente de só
-- exibir uma data na tela. `timestamptz` guarda o instante absoluto (grava em
-- UTC internamente, não depende do timezone da sessão do Postgres); a exibição
-- em horário de Brasília fica por conta do frontend (`lib/format.ts`, que
-- passa `timeZone: "America/Sao_Paulo"` explicitamente pro Intl.DateTimeFormat
-- — não fica implícito no fuso do navegador de quem estiver olhando a tela).
-- ============================================================================


-- ============================================================================
-- clientes — campos novos para a aba "Clientes" do CRM
-- ============================================================================
alter table clientes add column if not exists cidade varchar;
alter table clientes add column if not exists estado varchar(2);


-- ============================================================================
-- leads — rastro da mudança anterior (exibido no card/timeline) + carimbo da
-- última interação (alimenta o relatório "leads dormindo", ver
-- lib/usecases/comercial/registrarInteracao.ts)
-- ============================================================================
alter table leads add column if not exists etapa_anterior varchar;
alter table leads add column if not exists temperatura_anterior varchar;
alter table leads add column if not exists data_ultima_interacao timestamptz;


-- ----------------------------------------------------------------------------
-- historico_mudancas_leads — timeline de mudanças de etapa/temperatura de um
-- lead (separado de `interacoes_lead`, que é a timeline de CONTATOS/notas —
-- são dois históricos com propósitos diferentes, ver LeadDetailModal.tsx)
-- ----------------------------------------------------------------------------
create table if not exists historico_mudancas_leads (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads (id) on delete cascade,
  tipo_mudanca varchar not null
    check (tipo_mudanca in (
      'criacao', 'mudanca_etapa', 'mudanca_temperatura',
      'reativacao_manual', 'reativacao_automatica'
    )),
  etapa_anterior varchar,
  etapa_nova varchar,
  temperatura_anterior varchar,
  temperatura_nova varchar,
  data_mudanca timestamptz not null default now(),
  usuario_email varchar references usuarios (email),
  created_at timestamptz not null default now()
);

create index if not exists idx_historico_mudancas_leads_lead_id on historico_mudancas_leads (lead_id);
create index if not exists idx_historico_mudancas_leads_data on historico_mudancas_leads (data_mudanca);


-- ----------------------------------------------------------------------------
-- agendamentos_leads_frios — quando um lead vira "frio", agenda-se um retorno
-- automático (ver lib/usecases/comercial/mudarTemperatura.ts). A "automação"
-- real é um sweep sob demanda (lib/usecases/comercial/verificarReativacoesPendentes.ts),
-- disparado toda vez que a tela de leads ou de leads frios é carregada — não
-- um cron de verdade rodando em segundo plano (o projeto não tem
-- infraestrutura de cron hoje; Vercel Cron exigiria plano pago + vercel.json
-- novo, fora do escopo deste pedido). Na prática funciona igual para uma
-- ferramenta de uso interno em horário comercial: assim que alguém abre o
-- CRM depois do prazo vencido, a reativação acontece.
-- ----------------------------------------------------------------------------
create table if not exists agendamentos_leads_frios (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads (id) on delete cascade,
  temperatura_anterior varchar,
  etapa_anterior varchar,
  data_agendamento timestamptz not null default now(),
  data_retorno timestamptz not null,
  intervalo_dias int not null,
  status varchar not null default 'agendado'
    check (status in ('agendado', 'reativado', 'cancelado')),
  motivo_cancelamento text,
  created_at timestamptz not null default now(),
  reativado_em timestamptz
);

create index if not exists idx_agendamentos_leads_frios_lead_id on agendamentos_leads_frios (lead_id);
create index if not exists idx_agendamentos_leads_frios_status on agendamentos_leads_frios (status);
create index if not exists idx_agendamentos_leads_frios_data_retorno on agendamentos_leads_frios (data_retorno);


-- ----------------------------------------------------------------------------
-- config_reativacao_leads_frios — prazos de retorno por etapa (linha única,
-- id fixo = 1, mesmo padrão de `config_empresa`)
-- ----------------------------------------------------------------------------
create table if not exists config_reativacao_leads_frios (
  id serial primary key,
  dias_prospeccao int not null default 15,
  dias_contato int not null default 20,
  dias_proposta int not null default 30,
  dias_negociacao int not null default 40,
  updated_at timestamptz not null default now()
);

insert into config_reativacao_leads_frios (id, dias_prospeccao, dias_contato, dias_proposta, dias_negociacao)
values (1, 15, 20, 30, 40)
on conflict (id) do nothing;

drop trigger if exists trg_config_reativacao_leads_frios_updated_at on config_reativacao_leads_frios;
create trigger trg_config_reativacao_leads_frios_updated_at
  before update on config_reativacao_leads_frios
  for each row execute function set_updated_at();


-- ============================================================================
-- VIEWS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- v_clientes_resumo — cliente + contagem de leads + última interação (maior
-- entre a última atualização de qualquer lead do cliente e a última interação
-- registrada em qualquer um desses leads). Evita manter uma coluna
-- redundante em `clientes` que precisaria ser atualizada em vários pontos do
-- código (lead criado, interação registrada, etapa movida...) — a view
-- calcula isso sempre corrente, direto do dado de origem.
-- ----------------------------------------------------------------------------
drop view if exists v_clientes_resumo;
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
-- ROW LEVEL SECURITY — mesma política das tabelas existentes (acesso total
-- para qualquer usuário autenticado via Supabase Auth; sem acesso público)
-- ============================================================================
alter table historico_mudancas_leads enable row level security;
alter table agendamentos_leads_frios enable row level security;
alter table config_reativacao_leads_frios enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'historico_mudancas_leads', 'agendamentos_leads_frios', 'config_reativacao_leads_frios'
  ]
  loop
    execute format(
      'drop policy if exists "authenticated_all_%1$s" on %1$s;
       create policy "authenticated_all_%1$s" on %1$s
         for all
         to authenticated
         using (true)
         with check (true);',
      t
    );
  end loop;
end $$;


-- ============================================================================
-- Como aplicar: cole este arquivo inteiro no SQL Editor do Supabase e rode.
-- Seguro rodar de novo — nada aqui apaga dado existente.
--
-- Verificação rápida depois de rodar:
--   select * from config_reativacao_leads_frios;
--   select * from v_clientes_resumo limit 5;
--   select column_name from information_schema.columns where table_name = 'leads';
-- ============================================================================
