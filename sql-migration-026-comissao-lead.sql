-- ============================================================================
-- BR Isolamentos — Migração 026: sistema de comissão/indicação no Lead
-- (Comercial).
--
-- Pré-requisito: sql-migration-025-catalogo-padrao-composicao-camadas.sql já
-- aplicado. 100% aditiva e idempotente.
--
-- DECISÕES DE PROJETO (leia antes de aplicar — o pedido original assumia um
-- desenho de dados que não bate com o schema real; adaptado aqui):
--
-- 1) NÃO existe uma tabela `lead_anexo` nova — a migração 012
--    (sql-migration-012-anexos-lead.sql) já criou `anexos_lead` com
--    exatamente esse propósito (nome_arquivo/tipo_arquivo/tamanho_bytes/
--    storage_path/url/data_adicao), já com bucket de Storage e UI própria
--    (components/modules/comercial/AnexosLead.tsx). O comprovante de
--    comissão é só mais um anexo nessa mesma tabela — nenhuma tabela nova.
--
-- 2) `lancamentos_financeiros.lead_id` também JÁ EXISTE (migração 009) — só
--    não era usado por nenhum fluxo ainda. O lançamento automático ao
--    fechar um lead de comissão usa essa coluna, sem migração adicional
--    pra ela.
--
-- 3) `valor_comissao` é uma coluna GERADA (`generated always as ... stored`),
--    não um valor calculado e gravado pela aplicação — garante que o valor
--    nunca fica dessincronizado de `valor_indicado`/`percentual_comissao`
--    (útil também pra somar/filtrar direto em SQL nos relatórios/dashboard,
--    sem repetir a fórmula em toda query).
--
-- 4) `eh_comissao`/`parceiro_id`/`valor_indicado`/`percentual_comissao` vivem
--    na própria tabela `leads` (como pedido) — um lead de comissão é um
--    Lead normal com esses campos preenchidos, não uma entidade separada;
--    reaproveita etapa/temperatura/timeline/anexos que o Lead já tem.
--
-- 5) Categoria "Comissão Recebida" (receita) — nova, protegida (seed
--    padrão, só desativável). Não reaproveita "Comissão de parceiro"
--    (despesa, já existente desde a migração 009): aquela é a BR Isolamentos
--    PAGANDO um parceiro; esta é a BR Isolamentos RECEBENDO uma comissão por
--    indicar um cliente a um parceiro — direções opostas do caixa.
-- ============================================================================

alter table leads add column if not exists eh_comissao boolean not null default false;
alter table leads add column if not exists parceiro_id uuid references parceiros (id);
alter table leads add column if not exists valor_indicado numeric(12, 2);
alter table leads add column if not exists percentual_comissao numeric(5, 2);

-- Gerada — nunca gravada diretamente pela aplicação (ver decisão 3). Precisa
-- de um `drop column if exists` antes porque Postgres não permite
-- `add column if not exists ... generated always as` reaplicar a expressão
-- se a coluna já existir com uma definição diferente; como é sempre a MESMA
-- expressão aqui, o drop+recreate é seguro de rodar de novo.
alter table leads drop column if exists valor_comissao;
alter table leads add column valor_comissao numeric(12, 2)
  generated always as (round((coalesce(valor_indicado, 0) * coalesce(percentual_comissao, 0) / 100)::numeric, 2)) stored;

create index if not exists idx_leads_eh_comissao on leads (eh_comissao) where eh_comissao = true;
create index if not exists idx_leads_parceiro_id on leads (parceiro_id);

insert into categorias_lancamentos (nome, tipo, protegida) values
  ('Comissão Recebida', 'receita', true)
on conflict (nome) do nothing;

-- ============================================================================
-- Como aplicar: cole este arquivo inteiro no SQL Editor do Supabase e rode.
--
-- Verificação rápida:
--   select eh_comissao, parceiro_id, valor_indicado, percentual_comissao, valor_comissao
--   from leads where eh_comissao = true;
--   select nome, tipo, protegida from categorias_lancamentos where nome = 'Comissão Recebida';
-- ============================================================================
