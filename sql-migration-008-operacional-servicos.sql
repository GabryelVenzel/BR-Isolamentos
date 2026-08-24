-- ============================================================================
-- BR Isolamentos — Migração 008: módulo Operacional completo (parceiros
-- estendidos, fornecedores, serviços, sistema de códigos O/L/S,
-- integração Lead→Orçamento→Serviço)
--
-- Pré-requisito: sql-migration-007-responsaveis-telefone.sql já aplicado.
-- 100% aditiva e idempotente, mesmas regras dos arquivos anteriores.
--
-- DECISÕES DE PROJETO (leia antes de aplicar):
--
-- 1) `numero_orcamento` (O00001) é uma coluna NOVA, separada de
--    `orcamentos.numero` (já existe, formato "ORC-2026-0001", gerado em
--    lib/repositories/orcamento.repository.ts#proximoNumero e usado em PDFs
--    de proposta já emitidos). NÃO reaproveitamos/reformatamos `numero` —
--    mudar o formato de um identificador já impresso em propostas antigas
--    seria uma mudança arriscada e fora do pedido. `numero_orcamento` é o
--    código NOVO, específico da integração Lead→Orçamento→Serviço deste
--    módulo; `numero` continua sendo o número "oficial" da proposta.
--
-- 2) `parceiros.pessoas_mobilizadas`/`pessoas_disponiveis` do pedido original
--    eram colunas fixas (`GENERATED ALWAYS AS ...`). NÃO implementadas assim
--    de propósito: "mobilizado" depende de QUAL DIA você está olhando (é
--    exatamente o que a aba Capacidade pergunta — "quantas pessoas do
--    parceiro X estão mobilizadas no dia 14/08?"). Uma coluna fixa só
--    conseguiria representar um único instante ("agora"), não um calendário.
--    Por isso só `total_pessoas` é uma coluna armazenada; "mobilizadas"/
--    "disponíveis" são CALCULADAS por dia a partir dos serviços ativos
--    (ver lib/usecases/operacional/capacidade.ts), não colunas persistidas.
--
-- 3) Cada serviço tem UM parceiro principal + `pessoas_alocadas` (quantas
--    pessoas desse parceiro estão nesse serviço) — não uma tabela de junção
--    servico↔parceiro com headcount por parceiro. `parceiros_alocados`
--    (array) continua existindo para parceiros de apoio, mas sem headcount
--    individual. Simplificação deliberada: o pedido original também não
--    detalhava esse nível (a tabela `servicos` sugerida não tinha uma coluna
--    de headcount por parceiro alocado).
--
-- 4) A aba "Agenda" NÃO foi alterada — o pedido dizia "existente, manter".
--    Não foi criada a tabela `agendamentos_servicos` sugerida no pedido:
--    ela duplicaria o que a nova aba "Serviços" (com `data_inicio`/
--    `data_fim_prevista` por serviço) e a aba "Capacidade" já cobrem, sem
--    fragmentar em dois sistemas de agenda concorrentes na mesma tela.
--
-- 5) A coluna `status` do pedido original para `servicos` foi removida —
--    redundante com `etapa` (planejamento/execução/finalizado), que já é a
--    única fonte de verdade do estágio do serviço (mesmo raciocínio de
--    `leads.etapa` no módulo Comercial).
-- ============================================================================


-- ============================================================================
-- historico_mudancas_leads — novo tipo_mudanca "vinculo_orcamento" + coluna
-- `descricao` (a integração Lead→Orçamento passa a registrar esse evento na
-- timeline do lead — ver lib/usecases/comercial/vincularOrcamento.ts — e
-- precisa de um texto livre pra dizer QUAL orçamento foi vinculado, algo que
-- as colunas existentes de etapa/temperatura não capturam)
-- ============================================================================
alter table historico_mudancas_leads add column if not exists descricao text;

alter table historico_mudancas_leads drop constraint if exists historico_mudancas_leads_tipo_mudanca_check;
alter table historico_mudancas_leads add constraint historico_mudancas_leads_tipo_mudanca_check
  check (tipo_mudanca in (
    'criacao', 'mudanca_etapa', 'mudanca_temperatura',
    'reativacao_manual', 'reativacao_automatica', 'vinculo_orcamento'
  ));


-- ============================================================================
-- SISTEMA DE CÓDIGOS — sequences + trigger functions (O/L/S/P/F)
-- ============================================================================
create sequence if not exists seq_numero_orcamento;
create sequence if not exists seq_numero_lead;
create sequence if not exists seq_numero_servico;
create sequence if not exists seq_numero_parceiro;
create sequence if not exists seq_numero_fornecedor;

create or replace function gerar_numero_orcamento() returns trigger as $$
begin
  if new.numero_orcamento is null then
    new.numero_orcamento := 'O' || lpad(nextval('seq_numero_orcamento')::text, 5, '0');
  end if;
  return new;
end;
$$ language plpgsql;

create or replace function gerar_numero_lead() returns trigger as $$
begin
  if new.numero_lead is null then
    new.numero_lead := 'L' || lpad(nextval('seq_numero_lead')::text, 5, '0');
  end if;
  return new;
end;
$$ language plpgsql;

create or replace function gerar_numero_servico() returns trigger as $$
begin
  if new.numero_servico is null then
    new.numero_servico := 'S' || lpad(nextval('seq_numero_servico')::text, 5, '0');
  end if;
  return new;
end;
$$ language plpgsql;

create or replace function gerar_numero_parceiro() returns trigger as $$
begin
  if new.numero_parceiro is null then
    new.numero_parceiro := 'P' || lpad(nextval('seq_numero_parceiro')::text, 5, '0');
  end if;
  return new;
end;
$$ language plpgsql;

create or replace function gerar_numero_fornecedor() returns trigger as $$
begin
  if new.numero_fornecedor is null then
    new.numero_fornecedor := 'F' || lpad(nextval('seq_numero_fornecedor')::text, 5, '0');
  end if;
  return new;
end;
$$ language plpgsql;


-- ============================================================================
-- orcamentos — numero_orcamento (novo, ver decisão 1 acima)
-- ============================================================================
alter table orcamentos add column if not exists numero_orcamento varchar(20) unique;

drop trigger if exists trg_orcamentos_numero_orcamento on orcamentos;
create trigger trg_orcamentos_numero_orcamento
  before insert on orcamentos
  for each row execute function gerar_numero_orcamento();

-- Backfill dos orçamentos já existentes, na ordem de criação.
with numerados as (
  select id, 'O' || lpad(row_number() over (order by data_criacao, id)::text, 5, '0') as num
  from orcamentos
  where numero_orcamento is null
)
update orcamentos o set numero_orcamento = numerados.num
from numerados
where o.id = numerados.id;

select setval('seq_numero_orcamento', (select count(*) from orcamentos where numero_orcamento is not null), true);


-- ============================================================================
-- leads — numero_lead + orcamento_id (vínculo Lead→Orçamento, obrigatório
-- pra avançar pra etapa "proposta" — ver lib/usecases/comercial/moverLead.ts)
-- ============================================================================
alter table leads add column if not exists numero_lead varchar(20) unique;
alter table leads add column if not exists orcamento_id int references orcamentos (id);

create index if not exists idx_leads_orcamento_id on leads (orcamento_id);

drop trigger if exists trg_leads_numero_lead on leads;
create trigger trg_leads_numero_lead
  before insert on leads
  for each row execute function gerar_numero_lead();

with numerados as (
  select id, 'L' || lpad(row_number() over (order by created_at, id)::text, 5, '0') as num
  from leads
  where numero_lead is null
)
update leads l set numero_lead = numerados.num
from numerados
where l.id = numerados.id;

select setval('seq_numero_lead', (select count(*) from leads where numero_lead is not null), true);


-- ============================================================================
-- parceiros — campos novos (tipos de trabalho fixos, notas por tipo,
-- capacidade por headcount, CNPJ, código) — mantidos os campos antigos
-- (especialidades, custo_hora, disponibilidade_horas_semana) intactos: o
-- dashboard Resumo (v_capacidade_parceiros, gráfico Top Parceiros) e a
-- Agenda continuam usando o modelo antigo baseado em horas/semana.
-- ============================================================================
alter table parceiros add column if not exists numero_parceiro varchar(20) unique;
alter table parceiros add column if not exists cnpj varchar(20) unique;
alter table parceiros add column if not exists tipos_trabalho text[] not null default '{}';
alter table parceiros add column if not exists notas_bancada text;
alter table parceiros add column if not exists notas_caldeiraria text;
alter table parceiros add column if not exists notas_isolamentos_removiveis text;
alter table parceiros add column if not exists notas_isolamentos_fixos text;
alter table parceiros add column if not exists total_pessoas int;

drop trigger if exists trg_parceiros_numero_parceiro on parceiros;
create trigger trg_parceiros_numero_parceiro
  before insert on parceiros
  for each row execute function gerar_numero_parceiro();

with numerados as (
  select id, 'P' || lpad(row_number() over (order by created_at, id)::text, 5, '0') as num
  from parceiros
  where numero_parceiro is null
)
update parceiros p set numero_parceiro = numerados.num
from numerados
where p.id = numerados.id;

select setval('seq_numero_parceiro', (select count(*) from parceiros where numero_parceiro is not null), true);


-- ============================================================================
-- fornecedores (nova)
-- ============================================================================
create table if not exists fornecedores (
  id uuid primary key default gen_random_uuid(),
  numero_fornecedor varchar(20) unique,
  nome varchar not null,
  email varchar,
  telefone varchar,
  cnpj varchar unique,
  endereco text,
  cidade varchar,
  estado varchar(2),
  tipo_fornecimento varchar
    check (tipo_fornecimento in ('materiais', 'equipamentos', 'servicos')),
  especialidade text,
  notas text,
  pessoa_contato varchar,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_fornecedores_ativo on fornecedores (ativo);

drop trigger if exists trg_fornecedores_numero_fornecedor on fornecedores;
create trigger trg_fornecedores_numero_fornecedor
  before insert on fornecedores
  for each row execute function gerar_numero_fornecedor();

create or replace function set_updated_at_generico()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_fornecedores_updated_at on fornecedores;
create trigger trg_fornecedores_updated_at
  before update on fornecedores
  for each row execute function set_updated_at_generico();


-- ============================================================================
-- servicos (nova) — ver decisões 2, 3 e 5 no topo do arquivo
-- ============================================================================
create table if not exists servicos (
  id uuid primary key default gen_random_uuid(),
  numero_servico varchar(20) unique not null,

  lead_id uuid references leads (id) on delete set null,
  numero_lead varchar(20),
  orcamento_id int references orcamentos (id) on delete set null,
  numero_orcamento varchar(20),
  cliente_id int references clientes (id) on delete set null,

  etapa varchar not null default 'planejamento'
    check (etapa in ('planejamento', 'execucao', 'finalizado')),
  tipo_trabalho varchar
    check (tipo_trabalho in ('bancada', 'caldeiraria', 'isolamentos_removiveis', 'isolamentos_fixos')),

  valor_orcado numeric(12, 2),
  valor_real numeric(12, 2),

  data_inicio date,
  data_fim_prevista date,
  data_fim_real date,

  parceiro_principal_id uuid references parceiros (id),
  pessoas_alocadas int,
  parceiros_alocados uuid[] not null default '{}',

  descricao text,
  notas text,

  foto_principal_url text,
  fotos_url text[] not null default '{}',
  pdf_relatorio_url text,

  responsavel_email varchar references usuarios (email),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_servicos_lead_id on servicos (lead_id);
create index if not exists idx_servicos_orcamento_id on servicos (orcamento_id);
create index if not exists idx_servicos_etapa on servicos (etapa);
create index if not exists idx_servicos_parceiro_principal_id on servicos (parceiro_principal_id);
create index if not exists idx_servicos_responsavel_email on servicos (responsavel_email);

drop trigger if exists trg_servicos_numero_servico on servicos;
create trigger trg_servicos_numero_servico
  before insert on servicos
  for each row execute function gerar_numero_servico();

drop trigger if exists trg_servicos_updated_at on servicos;
create trigger trg_servicos_updated_at
  before update on servicos
  for each row execute function set_updated_at_generico();


-- ----------------------------------------------------------------------------
-- historico_servicos — timeline de mudanças de etapa (mesma ideia de
-- historico_mudancas_leads no módulo Comercial)
-- ----------------------------------------------------------------------------
create table if not exists historico_servicos (
  id uuid primary key default gen_random_uuid(),
  servico_id uuid not null references servicos (id) on delete cascade,
  tipo_evento varchar not null
    check (tipo_evento in ('criacao', 'mudanca_etapa', 'anexo_adicionado', 'finalizacao')),
  etapa_anterior varchar,
  etapa_nova varchar,
  descricao text,
  usuario_email varchar references usuarios (email),
  data_evento timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_historico_servicos_servico_id on historico_servicos (servico_id);

-- ----------------------------------------------------------------------------
-- interacoes_servico — timeline de contatos/notas (mesma ideia de
-- interacoes_lead)
-- ----------------------------------------------------------------------------
create table if not exists interacoes_servico (
  id uuid primary key default gen_random_uuid(),
  servico_id uuid not null references servicos (id) on delete cascade,
  tipo varchar not null check (tipo in ('nota', 'foto', 'chamada', 'email', 'reuniao')),
  descricao text not null,
  autor_email varchar references usuarios (email),
  data_interacao timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_interacoes_servico_servico_id on interacoes_servico (servico_id);


-- ============================================================================
-- STORAGE — bucket para fotos/PDF de serviços (mesmo padrão de
-- "propostas-imagens" em sql-schema.sql)
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('servicos-anexos', 'servicos-anexos', true)
on conflict (id) do nothing;

drop policy if exists "authenticated_insert_servicos_anexos" on storage.objects;
create policy "authenticated_insert_servicos_anexos" on storage.objects
  for insert to authenticated with check (bucket_id = 'servicos-anexos');

drop policy if exists "authenticated_delete_servicos_anexos" on storage.objects;
create policy "authenticated_delete_servicos_anexos" on storage.objects
  for delete to authenticated using (bucket_id = 'servicos-anexos');


-- ============================================================================
-- ROW LEVEL SECURITY — mesma política de sempre (acesso total autenticado)
-- ============================================================================
alter table fornecedores enable row level security;
alter table servicos enable row level security;
alter table historico_servicos enable row level security;
alter table interacoes_servico enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['fornecedores', 'servicos', 'historico_servicos', 'interacoes_servico']
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
--   select numero_orcamento from orcamentos order by data_criacao limit 5;
--   select numero_lead from leads order by created_at limit 5;
--   select * from fornecedores limit 1;
--   select * from storage.buckets where id = 'servicos-anexos';
-- ============================================================================
