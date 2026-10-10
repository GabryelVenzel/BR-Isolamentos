-- ============================================================================
-- Migração 043 — Valor fechado do lead
-- ============================================================================
-- O valor de uma venda fechada nem sempre é o valor do orçamento vinculado:
-- proposta por metro linear ou por unidade (o orçamento traz o preço unitário
-- e o fechamento é por quantidade), desconto negociado, escopo ajustado...
-- Até aqui a obra nascia com o valor do ORÇAMENTO como "orçado", mesmo quando
-- o que foi fechado era outro valor (caso da S00003: orçamento de R$ 293,36
-- por metro, 100 metros fechados).
--
-- O que muda:
--   - `leads.valor_fechado` — informado ao mover o lead para "Fechado" (o
--     sistema pede o valor, já sugerindo o do cartão). É esse valor que vira
--     o "orçado" da obra criada a partir do lead, e o que os indicadores de
--     vendas fechadas somam. O orçamento vinculado NÃO é alterado.
--   - Leads que já estão em "Fechado" recebem como valor fechado o valor
--     estimado que têm hoje no cartão (leads de comissão ficam de fora: o
--     valor deles é o da comissão).
--
-- NADA é apagado. Obras já criadas NÃO têm o valor orçado alterado por esta
-- migração.
--
-- ORDEM: rodar ANTES de publicar o código deste bloco. É seguro rodar com a
-- versão atual do site no ar.
--
-- Idempotente — pode rodar mais de uma vez.
-- ============================================================================

alter table leads add column if not exists valor_fechado numeric(12, 2);

alter table leads drop constraint if exists leads_valor_fechado_positivo;
alter table leads add constraint leads_valor_fechado_positivo check (valor_fechado is null or valor_fechado > 0);

update leads
   set valor_fechado = valor_estimado
 where etapa = 'fechado'
   and valor_fechado is null
   and coalesce(eh_comissao, false) = false
   and valor_estimado > 0;

-- ============================================================================
-- VERIFICAÇÃO
--
--   select numero_lead, etapa, valor_estimado, valor_fechado
--     from leads where etapa = 'fechado';
-- ============================================================================
