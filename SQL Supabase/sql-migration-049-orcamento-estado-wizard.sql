-- ============================================================================
-- Migração 049 — Estado do wizard guardado junto do orçamento (para editar)
-- ============================================================================
-- "Editar" um orçamento passa a reabri-lo no wizard completo (cliente, escopo,
-- especificações, preços, equipe e custos, revisão), como se estivesse sendo
-- orçado do zero — em vez da tela que só mudava status, margem e desconto.
--
-- Para reabrir exatamente como foi montado, o sistema guarda, ao salvar, uma
-- cópia do que estava no wizard: escopo e especificações de cada trecho,
-- ajustes de lápis, itens adicionais, equipe, diárias, custos operacionais,
-- margem e desconto. Essa cópia fica numa tabela própria (e não numa coluna de
-- `orcamentos`) para não pesar as listagens — Histórico e Kanban carregam os
-- orçamentos inteiros, e a cópia só interessa na hora de editar.
--
-- Orçamentos criados ANTES desta migração não têm a cópia: ao editar, o
-- sistema reconstrói o wizard a partir do que foi salvo (trechos, materiais,
-- valores) e avisa na tela o que precisa ser conferido.
--
-- NADA é alterado nos dados existentes.
--
-- ORDEM: pode rodar antes ou depois de publicar o código — sem a tabela, a
-- edição continua funcionando pelo caminho de reconstrução, só não guarda a
-- cópia. Depende da migração 039.
--
-- Idempotente — pode rodar mais de uma vez.
-- ============================================================================

create table if not exists orcamento_wizard_estado (
  orcamento_id integer primary key references orcamentos (id) on delete cascade,
  estado jsonb not null,
  atualizado_em timestamptz not null default now()
);

alter table orcamento_wizard_estado enable row level security;

-- Mesma regra padrão das demais tabelas (migração 039): usuário cadastrado e
-- ativo. Sai junto com o orçamento quando ele é removido de vez (cascade).
drop policy if exists "acesso_ativo_orcamento_wizard_estado" on orcamento_wizard_estado;
create policy "acesso_ativo_orcamento_wizard_estado" on orcamento_wizard_estado
  for all to authenticated
  using (public.usuario_ativo())
  with check (public.usuario_ativo());

-- ============================================================================
-- VERIFICAÇÃO
--
--   select count(*) from orcamento_wizard_estado;
--   -- 0 logo depois de rodar; passa a ter uma linha por orçamento salvo ou
--   -- editado a partir da publicação do código.
-- ============================================================================
