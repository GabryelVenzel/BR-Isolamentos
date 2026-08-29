-- ============================================================================
-- BR Isolamentos — Migração 027: categoria do parceiro (Prestador/Parceria/
-- Ambos) + lista de tipos de trabalho revisada.
--
-- Pré-requisito: sql-migration-026-comissao-lead.sql já aplicado. 100%
-- aditiva e idempotente.
--
-- DECISÕES DE PROJETO (leia antes de aplicar):
--
-- 1) Categoria nova (`categoria_parceiro`): distingue quem FORNECE MÃO DE
--    OBRA de verdade ("prestador", aparece na Agenda/Capacidade e pode ser
--    vinculado a um Serviço) de quem é só um canal de indicação/comissão
--    ("parceria", migração 026 — não mobiliza gente, só recebe indicações)
--    — "ambos" entra nos dois fluxos. Todo parceiro já cadastrado antes
--    desta migração vira "prestador" por padrão: é exatamente o que ele já
--    fazia até aqui (fornecer mão de obra) — "ambos" seria dar uma
--    permissão nova (aparecer nas indicações de comissão) que ninguém pediu
--    pros parceiros existentes.
--
-- 2) `tipos_trabalho` (`parceiros`/`servico_parceiros_execucao`) é `text[]`
--    SEM constraint de banco (só validado em Zod/TypeScript, ver
--    sql-migration-008) — trocar a lista de valores aceitos não precisa de
--    migração de schema, só de código (lib/validators, componentes). Esta
--    migração cobre só a coluna nova; a lista em si é ajustada no código.
--    Chaves preservadas (nenhuma migração de dado precisa rodar pra elas):
--    'bancada' e 'caldeiraria' (rótulo novo: "Caldeiraria (Fabricação)").
--    Removidas (sem substituto 1:1 — pedido reduziu a lista a 6 categorias
--    novas): 'isolamentos_removiveis', 'isolamentos_fixos'. Parceiros que
--    só tinham essas 2 marcadas precisam ser reclassificados manualmente
--    nas novas categorias (Isolador / Removível Montagem / Removível
--    Fabricação) — o dado antigo continua salvo no banco, só para de
--    aparecer marcado nos checkboxes novos até alguém revisar o cadastro.
-- ============================================================================

alter table parceiros add column if not exists categoria_parceiro varchar not null default 'prestador';

alter table parceiros drop constraint if exists parceiros_categoria_parceiro_check;
alter table parceiros add constraint parceiros_categoria_parceiro_check
  check (categoria_parceiro in ('prestador', 'parceria', 'ambos'));

create index if not exists idx_parceiros_categoria_parceiro on parceiros (categoria_parceiro);

-- ============================================================================
-- Como aplicar: cole este arquivo inteiro no SQL Editor do Supabase e rode.
--
-- Verificação rápida:
--   select categoria_parceiro, count(*) from parceiros group by categoria_parceiro;
-- ============================================================================
