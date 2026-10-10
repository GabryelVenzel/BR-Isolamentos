-- ============================================================================
-- Migração 041 — Financeiro ligado à obra: competência, forma de pagamento,
--                parcelas/recorrência e vínculos com fornecedor e parceiro
-- ============================================================================
-- Até aqui um lançamento tinha uma data só (que servia de vencimento e de
-- "mês a que pertence"), e fornecedor, parceiro e obra iam escritos na
-- descrição. Esta migração adiciona a `lancamentos_financeiros`:
--
--   1. `data_competencia` — a que mês o valor pertence (usada nos relatórios
--      de resultado: Receita x Despesa, DRE, margem). A coluna `data` que já
--      existia passa a significar só VENCIMENTO (quando paga/recebe).
--      Lançamentos existentes ficam com a competência igual à data atual
--      deles — nenhum relatório muda de valor ao rodar a migração.
--   2. `forma_pagamento` — pix, boleto, transferência, cartão, dinheiro, outro.
--   3. `fornecedor_id` e `parceiro_id` — a quem a despesa foi paga. (O vínculo
--      com a obra, `servico_id`, já existe desde a migração 009.)
--   4. `grupo_id`, `grupo_tipo`, `parcela_numero`, `parcela_total` — ligam
--      entre si os lançamentos gerados de uma vez por "parcelado em N" ou
--      "repetir por N meses".
--
-- Um gatilho preenche `data_competencia` com a própria `data` quando o
-- lançamento chega sem ela — é o que mantém funcionando os lançamentos
-- automáticos que já existem (custo fixo do mês, receita de serviço
-- finalizado, comissão de lead fechado) sem alterar nenhum deles.
--
-- NADA é apagado.
--
-- ORDEM: rodar ANTES de publicar o código deste bloco (a tela de lançamentos
-- nova lê e grava essas colunas). É seguro rodar com a versão atual do site
-- no ar.
--
-- Idempotente — pode rodar mais de uma vez.
-- ============================================================================

alter table lancamentos_financeiros add column if not exists data_competencia date;
alter table lancamentos_financeiros add column if not exists forma_pagamento varchar;
alter table lancamentos_financeiros add column if not exists fornecedor_id uuid references fornecedores (id) on delete set null;
alter table lancamentos_financeiros add column if not exists parceiro_id uuid references parceiros (id) on delete set null;
alter table lancamentos_financeiros add column if not exists grupo_id uuid;
alter table lancamentos_financeiros add column if not exists grupo_tipo varchar;
alter table lancamentos_financeiros add column if not exists parcela_numero int;
alter table lancamentos_financeiros add column if not exists parcela_total int;

alter table lancamentos_financeiros drop constraint if exists lancamentos_forma_pagamento_valida;
alter table lancamentos_financeiros add constraint lancamentos_forma_pagamento_valida
  check (forma_pagamento is null or forma_pagamento in ('pix', 'boleto', 'transferencia', 'cartao', 'dinheiro', 'outro'));

alter table lancamentos_financeiros drop constraint if exists lancamentos_grupo_tipo_valido;
alter table lancamentos_financeiros add constraint lancamentos_grupo_tipo_valido
  check (grupo_tipo is null or grupo_tipo in ('parcelado', 'recorrente'));

-- Competência dos lançamentos que já existem = a data que eles já tinham.
update lancamentos_financeiros
   set data_competencia = data
 where data_competencia is null;

-- Lançamento sem competência informada assume a do próprio vencimento.
create or replace function public.lancamento_preencher_competencia()
returns trigger
language plpgsql
as $$
begin
  if new.data_competencia is null then
    new.data_competencia := new.data;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_lancamento_competencia on lancamentos_financeiros;
create trigger trg_lancamento_competencia
  before insert or update on lancamentos_financeiros
  for each row execute function public.lancamento_preencher_competencia();

alter table lancamentos_financeiros alter column data_competencia set not null;

create index if not exists idx_lancamentos_financeiros_data_competencia on lancamentos_financeiros (data_competencia);
create index if not exists idx_lancamentos_financeiros_fornecedor_id on lancamentos_financeiros (fornecedor_id);
create index if not exists idx_lancamentos_financeiros_parceiro_id on lancamentos_financeiros (parceiro_id);
create index if not exists idx_lancamentos_financeiros_grupo_id on lancamentos_financeiros (grupo_id);

-- ============================================================================
-- VERIFICAÇÃO
--
-- 1) Nenhum lançamento sem competência (deve voltar 0):
--   select count(*) from lancamentos_financeiros where data_competencia is null;
--
-- 2) Colunas novas presentes:
--   select data, data_competencia, forma_pagamento, fornecedor_id, parceiro_id,
--          servico_id, grupo_tipo, parcela_numero, parcela_total
--     from lancamentos_financeiros order by data desc limit 5;
-- ============================================================================
