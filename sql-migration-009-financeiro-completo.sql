-- ============================================================================
-- BR Isolamentos — Migração 009: módulo Financeiro completo (custos fixos
-- com dia de pagamento + histórico, categorias centralizadas, anexos em
-- lançamentos, configuração do ciclo financeiro)
--
-- Pré-requisito: sql-migration-008-operacional-servicos.sql já aplicado
-- (usa a função `set_updated_at_generico()` de lá).
--
-- DECISÕES DE PROJETO (leia antes de aplicar):
--
-- 1) O pedido original sugeria tabelas novas `custos_fixos_v2` e
--    `lancamentos_financeiros_v2`. NÃO criadas — as tabelas `custos_fixos` e
--    `lancamentos_financeiros` já existem, já são usadas pelo dashboard
--    Resumo (view v_financeiro_mes_atual, gráficos Receita vs Despesa,
--    alertas de contas a receber) e pelo módulo Operacional (finalização de
--    serviço vai gravar lançamento nelas). Criar uma "v2" duplicaria a fonte
--    de verdade e quebraria tudo que já lê a tabela original. Em vez disso,
--    ambas são ESTENDIDAS aditivamente (ALTER TABLE ADD COLUMN).
--
-- 2) `categorias_lancamentos` é só uma lista curada de nomes — `categoria`
--    em `lancamentos_financeiros`/`custos_fixos` continua sendo texto livre
--    (não uma FK). Trocar pra FK exigiria migrar todos os valores já
--    gravados e mudar o tipo da coluna; o formulário de lançamento passa a
--    OFERECER as categorias centralizadas num <select>, mas o dado
--    persistido continua sendo o nome, mantendo compatibilidade com tudo
--    que já lê essa coluna.
--
-- 3) `historico_custos_fixos` NÃO é pré-gerado pra 12 meses no futuro (como
--    o pedido sugeria) — é criado SOB DEMANDA: toda vez que a aba Custos
--    Fixos carrega, garante que existe uma linha para o mês atual de cada
--    custo ativo (mesmo padrão de sweep sob demanda já usado pra reativação
--    de leads frios no módulo Comercial). Pré-gerar 12 meses de obrigações
--    futuras que podem nunca acontecer (custo pode ser desativado/editado
--    antes de vencer) criaria lixo de dados sem necessidade.
--
-- 4) IA de validação de PDF: NÃO implementada (pedido explícito era só
--    "deixar estrutura"). `anexos` em `lancamentos_financeiros` é `jsonb`
--    (array de objetos {url, nome, tamanho, status_validacao,
--    notas_validacao}), não um array de texto puro — dá pra guardar o
--    status por arquivo quando essa feature existir, sem precisar de nova
--    migration.
-- ============================================================================


-- ============================================================================
-- custos_fixos — dia do mês pra pagamento + notas
-- ============================================================================
alter table custos_fixos add column if not exists dia_mes int check (dia_mes between 1 and 31);
alter table custos_fixos add column if not exists notas text;


-- ----------------------------------------------------------------------------
-- historico_custos_fixos — ledger de pagamentos por mês (ver decisão 3)
-- ----------------------------------------------------------------------------
create table if not exists historico_custos_fixos (
  id uuid primary key default gen_random_uuid(),
  custo_fixo_id uuid not null references custos_fixos (id) on delete cascade,
  data_prevista date not null,
  data_pagamento date,
  valor numeric(10, 2) not null,
  status varchar not null default 'pendente'
    check (status in ('pendente', 'pago', 'atrasado')),
  -- Lançamento criado ao marcar como pago (ver
  -- lib/usecases/financeiro/marcarCustoFixoPago.ts) — rastreia a obrigação
  -- até o lançamento real no fluxo de caixa.
  lancamento_id uuid references lancamentos_financeiros (id) on delete set null,
  created_at timestamptz not null default now(),
  -- Um custo fixo só tem UM registro de histórico por mês previsto.
  unique (custo_fixo_id, data_prevista)
);

create index if not exists idx_historico_custos_fixos_custo_fixo_id on historico_custos_fixos (custo_fixo_id);


-- ============================================================================
-- categorias_lancamentos (nova, ver decisão 2)
-- ============================================================================
create table if not exists categorias_lancamentos (
  id uuid primary key default gen_random_uuid(),
  nome varchar not null unique,
  descricao text,
  tipo varchar not null check (tipo in ('receita', 'despesa')),
  cor varchar,
  ativo boolean not null default true,
  -- Categorias pré-definidas (seed abaixo) não podem ser EXCLUÍDAS — só
  -- desativadas (ativo = false). Categorias criadas pelo usuário podem ser
  -- excluídas (se não tiverem lançamentos, ver
  -- lib/usecases/financeiro/removerCategoria.ts).
  protegida boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_categorias_lancamentos_updated_at on categorias_lancamentos;
create trigger trg_categorias_lancamentos_updated_at
  before update on categorias_lancamentos
  for each row execute function set_updated_at_generico();

-- "Outro" do pedido original vira "Outra receita"/"Outra despesa" — `nome` é
-- UNIQUE (não há uma segunda coluna que diferencie por tipo), então as duas
-- entradas "Outro" do pedido precisam de nomes distintos.
insert into categorias_lancamentos (nome, tipo, protegida) values
  ('Venda de orçamento/serviço', 'receita', true),
  ('Retorno de investimento', 'receita', true),
  ('Outra receita', 'receita', true),
  ('Custo fixo', 'despesa', true),
  ('Custo variável', 'despesa', true),
  ('Salário', 'despesa', true),
  ('Comissão de vendedor', 'despesa', true),
  ('Comissão de parceiro', 'despesa', true),
  ('Compra de material', 'despesa', true),
  ('Mão de obra subcontratada', 'despesa', true),
  ('Imposto e tributo', 'despesa', true),
  ('Banco e financeiro', 'despesa', true),
  ('Outra despesa', 'despesa', true)
on conflict (nome) do nothing;


-- ============================================================================
-- lancamentos_financeiros — anexos (múltiplos PDFs) + vínculo com serviço/lead
-- (orcamento_id já existia)
-- ============================================================================
alter table lancamentos_financeiros add column if not exists anexos jsonb not null default '[]';
alter table lancamentos_financeiros add column if not exists servico_id uuid references servicos (id) on delete set null;
alter table lancamentos_financeiros add column if not exists lead_id uuid references leads (id) on delete set null;

create index if not exists idx_lancamentos_financeiros_servico_id on lancamentos_financeiros (servico_id);
create index if not exists idx_lancamentos_financeiros_lead_id on lancamentos_financeiros (lead_id);


-- ============================================================================
-- config_financeiro — linha única (id fixo = 1), mesmo padrão de
-- config_empresa / config_reativacao_leads_frios. Só o ciclo financeiro por
-- enquanto — "moeda padrão" já é BRL fixo em todo o app (não há outro valor
-- suportado em lugar nenhum do código), "backup automático" é
-- responsabilidade de infraestrutura do Supabase (fora do escopo de uma
-- tela de configuração do app), "exportar dados" não foi detalhado o
-- suficiente no pedido (qual formato exato, quais dados) pra implementar
-- com confiança — os três ficam de fora desta versão.
-- ============================================================================
create table if not exists config_financeiro (
  id serial primary key,
  -- Dia do mês em que o "mês financeiro" começa (1 = calendário normal,
  -- ex.: 20 = ciclo 20→19). Guardado mas AINDA NÃO usado pelos cálculos
  -- existentes (v_financeiro_mes_atual, relatórios) — esses continuam no
  -- calendário civil; aplicar essa configuração neles é uma mudança maior,
  -- documentada como próximo passo, não implementada aqui.
  dia_inicio_ciclo int not null default 1 check (dia_inicio_ciclo between 1 and 28),
  updated_at timestamptz not null default now()
);

insert into config_financeiro (id, dia_inicio_ciclo) values (1, 1)
on conflict (id) do nothing;

drop trigger if exists trg_config_financeiro_updated_at on config_financeiro;
create trigger trg_config_financeiro_updated_at
  before update on config_financeiro
  for each row execute function set_updated_at_generico();


-- ============================================================================
-- STORAGE — bucket para PDFs anexados a lançamentos (mesmo padrão de
-- "servicos-anexos" na migração 008 / "propostas-imagens" no schema base)
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('lancamentos-anexos', 'lancamentos-anexos', true)
on conflict (id) do nothing;

drop policy if exists "authenticated_insert_lancamentos_anexos" on storage.objects;
create policy "authenticated_insert_lancamentos_anexos" on storage.objects
  for insert to authenticated with check (bucket_id = 'lancamentos-anexos');

drop policy if exists "authenticated_delete_lancamentos_anexos" on storage.objects;
create policy "authenticated_delete_lancamentos_anexos" on storage.objects
  for delete to authenticated using (bucket_id = 'lancamentos-anexos');


-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table historico_custos_fixos enable row level security;
alter table categorias_lancamentos enable row level security;
alter table config_financeiro enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['historico_custos_fixos', 'categorias_lancamentos', 'config_financeiro']
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
--
-- Verificação rápida:
--   select nome, tipo, protegida from categorias_lancamentos order by tipo, nome;
--   select * from config_financeiro;
--   select column_name from information_schema.columns where table_name = 'custos_fixos';
-- ============================================================================
