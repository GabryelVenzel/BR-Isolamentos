-- ============================================================================
-- BR Isolamentos — Migração 036: Categorias de receita específicas por tipo
-- de serviço, no lugar da genérica "Venda de orçamento/serviço".
--
-- Pré-requisito: sql-migration-035-remove-unique-categoria-custos-fixos.sql
-- já aplicado.
-- 100% aditiva e idempotente (a desativação é a única alteração em linha
-- existente, e é idempotente por natureza).
--
-- Pedido explícito: a "Distribuição de Receitas" (gráfico da aba Financeira/
-- Geral do Resumo) sempre mostrava 100% numa única fatia genérica — pouco
-- útil pra análise. Passa a ter 6 categorias específicas por tipo de
-- isolamento vendido.
--
-- "Venda de orçamento/serviço" é `protegida` — não pode ser EXCLUÍDA (ver
-- lib/usecases/financeiro/removerCategoria.ts), só desativada
-- (ativo = false). Lançamentos antigos com essa categoria continuam
-- existindo e sendo exibidos normalmente (categoria é texto livre, não FK —
-- ver decisão 2 na migração 009); só deixa de aparecer como opção pra
-- lançamentos NOVOS.
--
-- `finalizarServico` (lib/usecases/operacional/finalizarServico.ts) não cria
-- mais um lançamento de receita sozinho ao finalizar um serviço — nenhuma
-- das 6 categorias novas é derivável automaticamente a partir dos dados do
-- serviço (pedido explícito), então a receita da venda passa a ser sempre
-- lançada manualmente, escolhendo a categoria certa caso a caso.
-- ============================================================================

update categorias_lancamentos
set ativo = false
where nome = 'Venda de orçamento/serviço';

insert into categorias_lancamentos (nome, tipo, protegida) values
  ('M.O. Fixo Quente', 'receita', true),
  ('M.O. Fixo Frio', 'receita', true),
  ('M.O. Removível', 'receita', true),
  ('Material e M.O. Fixo Quente', 'receita', true),
  ('Material e M.O. Fixo Frio', 'receita', true),
  ('M.O. Delineamento', 'receita', true)
on conflict (nome) do nothing;

-- ============================================================================
-- Como aplicar: cole este arquivo inteiro no SQL Editor do Supabase e rode.
-- ============================================================================
