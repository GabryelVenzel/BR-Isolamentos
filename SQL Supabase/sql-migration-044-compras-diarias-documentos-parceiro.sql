-- ============================================================================
-- Migração 044 — Compras (pedidos e cotações), diárias de mão de obra e
--                validade dos documentos de parceiros
-- ============================================================================
-- Tabelas novas do módulo Operacional:
--
--   1. `pedidos_compra` + `pedido_compra_itens` — pedido a um fornecedor
--      (itens, quantidades, preços, obra de destino, previsão de entrega),
--      com situação rascunho → enviado → recebido (ou cancelado). Ao receber,
--      o app gera a conta a pagar ligada ao fornecedor e à obra
--      (`lancamento_id`). Os itens dos pedidos enviados/recebidos são a base
--      do histórico de preços.
--   2. `cotacoes` + `cotacao_propostas` — o mesmo conjunto de itens cotado
--      com vários fornecedores, para comparar lado a lado e transformar a
--      proposta escolhida em pedido de compra.
--   3. `diarias` — apontamento de mão de obra por obra e por dia: parceiro
--      OU funcionário, período, pessoas, função e valor.
--   3b. `servico_funcionarios_execucao` — funcionários da equipe própria
--      alocados numa obra, com as funções que exercem nela (o equivalente,
--      para funcionários, de `servico_parceiros_execucao`). Cada funcionário
--      alocado conta como 1 pessoa mobilizada na Agenda/Capacidade.
--
-- Colunas novas:
--   4. `parceiro_anexos.validade` — data de validade do documento (ASO, NR,
--      apólice...). Parceiro com documento vencido gera aviso ao ser alocado
--      numa obra e entra na central de pendências.
--   4b. `funcionarios.tipos_trabalho` — funções que o funcionário exerce, na
--      mesma lista usada para parceiros e obras. `parceiros.notas_ajudante` —
--      observação da nova função "Ajudante" (a lista de funções em si não
--      fica no banco: é validada pelo app).
--
-- Regras de acesso:
--   5. As tabelas novas seguem a regra padrão (usuário ativo) e entram na
--      auditoria. A separação por módulo é feita pelo app (rotas de
--      /operacional), como nas demais tabelas do Operacional.
--   5b. `funcionarios`: quem tem o módulo Operacional passa a LER o cadastro
--      (nome, cargo, funções) para poder alocar funcionários em obras e
--      apontar diárias; incluir, alterar e excluir continua só com o módulo
--      RH. Os documentos dos funcionários continuam fechados ao RH — o aviso
--      de documento vencido usa a função `documentos_vencidos_funcionarios()`,
--      que devolve só nome do funcionário, nome do documento e validade.
--   6. Lançamentos: quem tem o módulo Operacional passa a poder ler e criar
--      também o lançamento ligado a um FORNECEDOR (além do ligado a uma obra,
--      que já podia desde a migração 039) — é o que permite "receber pedido"
--      gerar a conta a pagar mesmo quando a compra não é de uma obra
--      específica. Alterar e excluir lançamentos continua só com Financeiro.
--
-- NADA é apagado.
--
-- ORDEM: rodar ANTES de publicar o código deste bloco. É seguro rodar com a
-- versão atual do site no ar. Depende das migrações 039 e 041.
--
-- Idempotente — pode rodar mais de uma vez.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Validade dos documentos de parceiro
-- ----------------------------------------------------------------------------
alter table parceiro_anexos add column if not exists validade date;
create index if not exists idx_parceiro_anexos_validade on parceiro_anexos (validade) where validade is not null;

-- ----------------------------------------------------------------------------
-- 2. Cotações
-- ----------------------------------------------------------------------------
create sequence if not exists seq_cotacoes;

create table if not exists cotacoes (
  id uuid primary key default gen_random_uuid(),
  numero varchar not null unique default ('CT' || lpad(nextval('seq_cotacoes')::text, 5, '0')),
  titulo text not null,
  servico_id uuid references servicos (id) on delete set null,
  status varchar not null default 'aberta' check (status in ('aberta', 'concluida', 'cancelada')),
  -- Itens cotados: [{ "id": "...", "descricao": "...", "unidade": "m2", "quantidade": 10 }]
  itens jsonb not null default '[]'::jsonb,
  observacoes text,
  criado_por varchar,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists cotacao_propostas (
  id uuid primary key default gen_random_uuid(),
  cotacao_id uuid not null references cotacoes (id) on delete cascade,
  fornecedor_id uuid not null references fornecedores (id) on delete restrict,
  -- Preço unitário por item da cotação: { "<id do item>": 12.34 }
  precos jsonb not null default '{}'::jsonb,
  prazo_entrega_dias int check (prazo_entrega_dias is null or prazo_entrega_dias >= 0),
  condicao_pagamento text,
  observacoes text,
  created_at timestamptz not null default now(),
  unique (cotacao_id, fornecedor_id)
);

create index if not exists idx_cotacoes_servico_id on cotacoes (servico_id);
create index if not exists idx_cotacao_propostas_cotacao_id on cotacao_propostas (cotacao_id);

-- ----------------------------------------------------------------------------
-- 3. Pedidos de compra
-- ----------------------------------------------------------------------------
create sequence if not exists seq_pedidos_compra;

create table if not exists pedidos_compra (
  id uuid primary key default gen_random_uuid(),
  numero varchar not null unique default ('PC' || lpad(nextval('seq_pedidos_compra')::text, 5, '0')),
  fornecedor_id uuid not null references fornecedores (id) on delete restrict,
  servico_id uuid references servicos (id) on delete set null,
  cotacao_id uuid references cotacoes (id) on delete set null,
  status varchar not null default 'rascunho' check (status in ('rascunho', 'enviado', 'recebido', 'cancelado')),
  data_pedido date not null default current_date,
  previsao_entrega date,
  data_recebimento date,
  observacoes text,
  valor_total numeric(12, 2) not null default 0,
  -- Conta a pagar gerada ao receber o pedido.
  lancamento_id uuid references lancamentos_financeiros (id) on delete set null,
  criado_por varchar,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pedido_compra_itens (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos_compra (id) on delete cascade,
  descricao text not null,
  unidade varchar not null default 'un',
  quantidade numeric(12, 3) not null check (quantidade > 0),
  preco_unitario numeric(12, 4) not null default 0 check (preco_unitario >= 0),
  -- Item correspondente no catálogo de preços do orçamento (opcional) —
  -- permite comparar o preço pago com o preço usado nos orçamentos.
  preco_config_id int references precos_config (id) on delete set null,
  ordem int not null default 0
);

create index if not exists idx_pedidos_compra_fornecedor_id on pedidos_compra (fornecedor_id);
create index if not exists idx_pedidos_compra_servico_id on pedidos_compra (servico_id);
create index if not exists idx_pedidos_compra_status on pedidos_compra (status);
create index if not exists idx_pedido_compra_itens_pedido_id on pedido_compra_itens (pedido_id);

-- ----------------------------------------------------------------------------
-- 4. Diárias
-- ----------------------------------------------------------------------------
create table if not exists diarias (
  id uuid primary key default gen_random_uuid(),
  servico_id uuid not null references servicos (id) on delete cascade,
  -- Quem trabalhou: um parceiro OU um funcionário da equipe própria.
  parceiro_id uuid references parceiros (id) on delete restrict,
  funcionario_id uuid references funcionarios (id) on delete restrict,
  data date not null,
  periodo varchar not null default 'integral' check (periodo in ('manha', 'tarde', 'noite', 'integral')),
  pessoas int not null default 1 check (pessoas > 0),
  funcao text,
  -- Valor total do apontamento (todas as pessoas, no período).
  valor numeric(12, 2) not null default 0 check (valor >= 0),
  observacoes text,
  criado_por varchar,
  created_at timestamptz not null default now(),
  constraint diarias_parceiro_ou_funcionario check ((parceiro_id is null) <> (funcionario_id is null))
);

create index if not exists idx_diarias_funcionario_id on diarias (funcionario_id);
create index if not exists idx_diarias_servico_id on diarias (servico_id);
create index if not exists idx_diarias_parceiro_id on diarias (parceiro_id);
create index if not exists idx_diarias_data on diarias (data);

-- ----------------------------------------------------------------------------
-- 4b. Funcionários na execução de obras e função "Ajudante"
-- ----------------------------------------------------------------------------
alter table parceiros add column if not exists notas_ajudante text;
alter table funcionarios add column if not exists tipos_trabalho text[] not null default '{}';

create table if not exists servico_funcionarios_execucao (
  id uuid primary key default gen_random_uuid(),
  servico_id uuid not null references servicos (id) on delete cascade,
  funcionario_id uuid not null references funcionarios (id) on delete cascade,
  tipos_trabalho text[] not null default '{}',
  data_adicao timestamptz not null default now(),
  unique (servico_id, funcionario_id)
);

create index if not exists idx_servico_funcionarios_execucao_servico_id on servico_funcionarios_execucao (servico_id);
create index if not exists idx_servico_funcionarios_execucao_funcionario_id on servico_funcionarios_execucao (funcionario_id);

-- Documentos vencidos de funcionários ativos, sem abrir a tabela de documentos
-- (que continua só do RH): devolve apenas o necessário para o aviso.
create or replace function public.documentos_vencidos_funcionarios()
returns table (funcionario_id uuid, funcionario text, nome text, validade date)
language sql
stable
security definer
set search_path = public
as $$
  select f.id, f.nome::text, a.nome::text, a.validade
    from funcionario_anexos a
    join funcionarios f on f.id = a.funcionario_id
   where public.usuario_ativo()
     and f.status = 'ativo'
     and a.validade is not null
     and a.validade < (now() at time zone 'America/Sao_Paulo')::date;
$$;

revoke all on function public.documentos_vencidos_funcionarios() from public;
grant execute on function public.documentos_vencidos_funcionarios() to authenticated;

-- Cadastro de funcionários: Operacional lê, só RH grava.
drop policy if exists "acesso_rh_funcionarios" on funcionarios;
drop policy if exists "acesso_funcionarios_leitura" on funcionarios;
create policy "acesso_funcionarios_leitura" on funcionarios
  for select to authenticated
  using (public.tem_modulo('rh', 'operacional'));

drop policy if exists "acesso_funcionarios_inclusao" on funcionarios;
create policy "acesso_funcionarios_inclusao" on funcionarios
  for insert to authenticated
  with check (public.tem_modulo('rh'));

drop policy if exists "acesso_funcionarios_alteracao" on funcionarios;
create policy "acesso_funcionarios_alteracao" on funcionarios
  for update to authenticated
  using (public.tem_modulo('rh'))
  with check (public.tem_modulo('rh'));

drop policy if exists "acesso_funcionarios_exclusao" on funcionarios;
create policy "acesso_funcionarios_exclusao" on funcionarios
  for delete to authenticated
  using (public.tem_modulo('rh'));

-- ----------------------------------------------------------------------------
-- 5. Regras de acesso e auditoria das tabelas novas
-- ----------------------------------------------------------------------------
do $$
declare
  v_tabela text;
begin
  foreach v_tabela in array array['cotacoes', 'cotacao_propostas', 'pedidos_compra', 'pedido_compra_itens', 'diarias', 'servico_funcionarios_execucao']
  loop
    execute format('alter table %I enable row level security', v_tabela);
    execute format('drop policy if exists %I on %I', 'acesso_ativo_' || v_tabela, v_tabela);
    execute format(
      'create policy %I on %I for all to authenticated using (public.usuario_ativo()) with check (public.usuario_ativo())',
      'acesso_ativo_' || v_tabela, v_tabela
    );
  end loop;

  -- Itens de pedido ficam fora da auditoria: são regravados em bloco a cada
  -- edição do pedido (a alteração aparece no próprio pedido, pelo valor total).
  foreach v_tabela in array array['cotacoes', 'cotacao_propostas', 'pedidos_compra', 'diarias', 'servico_funcionarios_execucao']
  loop
    execute format('drop trigger if exists trg_auditoria on %I', v_tabela);
    execute format(
      'create trigger trg_auditoria after insert or update or delete on %I for each row execute function public.registrar_auditoria()',
      v_tabela
    );
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 6. Lançamentos: Operacional também lê/cria o que é ligado a fornecedor
-- ----------------------------------------------------------------------------
drop policy if exists "acesso_lancamentos_leitura" on lancamentos_financeiros;
create policy "acesso_lancamentos_leitura" on lancamentos_financeiros
  for select to authenticated
  using (
    public.tem_modulo('financeiro', 'resumo')
    or ((servico_id is not null or fornecedor_id is not null) and public.tem_modulo('operacional'))
    or (lead_id is not null and public.tem_modulo('comercial'))
  );

drop policy if exists "acesso_lancamentos_inclusao" on lancamentos_financeiros;
create policy "acesso_lancamentos_inclusao" on lancamentos_financeiros
  for insert to authenticated
  with check (
    public.tem_modulo('financeiro')
    or ((servico_id is not null or fornecedor_id is not null) and public.tem_modulo('operacional'))
    or (lead_id is not null and public.tem_modulo('comercial'))
  );

-- ============================================================================
-- VERIFICAÇÃO
--
-- Tabelas novas criadas (6 linhas):
--   select table_name from information_schema.tables
--    where table_schema = 'public'
--      and table_name in ('cotacoes', 'cotacao_propostas', 'pedidos_compra', 'pedido_compra_itens', 'diarias', 'servico_funcionarios_execucao')
--    order by 1;
-- ============================================================================
