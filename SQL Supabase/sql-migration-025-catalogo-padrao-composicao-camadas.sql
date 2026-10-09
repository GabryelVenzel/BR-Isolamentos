-- ============================================================================
-- BR Isolamentos — Migração 025: catálogo de chapas/isolantes reduzido a um
-- padrão fixo + composição de camadas para espessuras fora do padrão.
--
-- Pré-requisito: sql-migration-024-fix-timezone-timestamps.sql já aplicado.
-- Idempotente (add column if not exists / delete+insert determinístico).
--
-- DECISÕES DE PROJETO (leia antes de aplicar):
--
-- 1) PEDIDO: "vamos trabalhar com um padrão e tudo fora do padrão uso a
--    opção de outros itens" — a lista enorme de combinações material×
--    espessura de chaparia/isolante (migrações 016/017) é REMOVIDA e
--    substituída por um catálogo fixo bem menor: 3 chapas (uma espessura
--    cada) e 7 isolantes (cada linha é uma combinação específica de
--    material+densidade+espessura). Qualquer material fora dessa lista
--    continua coberto pela opção "➕ Outro material" do wizard (já existia,
--    não muda). Preço de todas as linhas novas entra em 0 — mesmo padrão já
--    usado nas migrações 010/016 — a definir pelo usuário em Configurar
--    Preços; não fabrico preço real que não tenho.
--
-- 2) Espuma Elastomérica: diferente da migração 016 (que preservava a linha
--    existente sem recriar), agora ela PRECISA virar 2 linhas (18mm/25mm em
--    vez de 1 linha "50kg/m³" sem espessura) — não dá pra preservar um
--    preço único que cobria uma granularidade diferente. Reseta pra 0 como
--    as demais.
--
-- 3) Colunas novas `familia` e `espessura_mm`: só isolante usa as duas.
--    `familia` agrupa as linhas de espessura diferente do MESMO produto
--    comercial (ex.: as 2 linhas de "Feltro de Lã de Rocha 64kg/m³" — 25mm e
--    51mm — compartilham `familia = 'Feltro de Lã de Rocha 64kg/m³'`) — é a
--    chave que `comporCamadasIsolante` (lib/usecases/orcamento/
--    composicaoIsolante.ts) usa para saber quais espessuras padrão existem
--    pra compor quando a espessura exigida do trecho não bate com nenhuma
--    linha sozinha (ex.: 75mm = 50mm + 25mm de Fibra Cerâmica). Chaparia/
--    acessório ficam com as 2 colunas null — não fazem composição (cada
--    chapa já é uma espessura só, "0,5mm").
--
-- 4) A física do cálculo térmico (materiais_isolantes, lib/usecases/
--    orcamento/materialFisico.ts) não muda — continua casando por
--    `tipo_material` (categoria) + densidade mais próxima, sem se importar
--    com quantas linhas de espessura cada família tem.
-- ============================================================================

alter table precos_config add column if not exists familia varchar;
alter table precos_config add column if not exists espessura_mm numeric;

-- --------------------------------------------------------------------------
-- Chapas: 3 espessuras/material (migração 016) -> 1 espessura padrão (0,5mm)
-- por material (decisão 1).
-- --------------------------------------------------------------------------
delete from precos_config where tipo_material in ('chaparia_inox', 'chaparia_galvanizado', 'chaparia_aluminio');
insert into precos_config (tipo_material, descricao, especificacao, unidade, preco_unitario, densidade_kg_m3, ordem, familia, espessura_mm) values
  ('chaparia_aluminio', 'Chapa Alumínio 0,5mm', '0,5mm', 'm2', 0, null, 1, null, 0.5),
  ('chaparia_galvanizado', 'Chapa Aço Galvanizado 0,5mm', '0,5mm', 'm2', 0, null, 1, null, 0.5),
  ('chaparia_inox', 'Chapa Inox 0,5mm', '0,5mm', 'm2', 0, null, 1, null, 0.5);

-- --------------------------------------------------------------------------
-- Isolantes: lista de densidades livres (migração 016/017) -> 7 linhas fixas
-- (material+densidade+espessura), agrupadas em 4 famílias via `familia`
-- (decisão 3). `densidade_kg_m3` alimenta a mesma ponte física de sempre
-- (materialFisico.ts) — Feltro e Manta c/Tela são as 2 famílias de Lã de
-- Rocha (mesma `tipo_material`, mesma densidade 64kg/m³, `familia`
-- diferente pra não se misturarem na composição de camadas).
-- --------------------------------------------------------------------------
delete from precos_config where tipo_material in ('isolante_fibra_ceramica', 'isolante_la_rocha', 'isolante_espuma');
insert into precos_config (tipo_material, descricao, especificacao, unidade, preco_unitario, densidade_kg_m3, ordem, familia, espessura_mm) values
  ('isolante_la_rocha', 'Feltro de Lã de Rocha 64kg/m³ 25mm', '64kg/m³', 'm2', 0, 64, 1, 'Feltro de Lã de Rocha 64kg/m³', 25),
  ('isolante_la_rocha', 'Feltro de Lã de Rocha 64kg/m³ 51mm', '64kg/m³', 'm2', 0, 64, 2, 'Feltro de Lã de Rocha 64kg/m³', 51),
  ('isolante_la_rocha', 'Manta de Lã de Rocha com Tela 64kg/m³ 50mm', '64kg/m³', 'm2', 0, 64, 3, 'Manta de Lã de Rocha com Tela 64kg/m³', 50),
  ('isolante_fibra_ceramica', 'Manta de Fibra Cerâmica 96kg/m³ 25mm', '96kg/m³', 'm2', 0, 96, 1, 'Manta de Fibra Cerâmica 96kg/m³', 25),
  ('isolante_fibra_ceramica', 'Manta de Fibra Cerâmica 96kg/m³ 50mm', '96kg/m³', 'm2', 0, 96, 2, 'Manta de Fibra Cerâmica 96kg/m³', 50),
  ('isolante_espuma', 'Espuma Elastomérica 50kg/m³ 18mm', '50kg/m³', 'm2', 0, 50, 1, 'Espuma Elastomérica 50kg/m³', 18),
  ('isolante_espuma', 'Espuma Elastomérica 50kg/m³ 25mm', '50kg/m³', 'm2', 0, 50, 2, 'Espuma Elastomérica 50kg/m³', 25);

-- ============================================================================
-- Como aplicar: cole este arquivo inteiro no SQL Editor do Supabase e rode.
--
-- Verificação rápida:
--   select tipo_material, familia, especificacao, espessura_mm, preco_unitario
--   from precos_config
--   where tipo_material like 'chaparia_%' or tipo_material like 'isolante_%'
--   order by tipo_material, ordem;
--
-- IMPORTANTE: depois de rodar, entre em Configurar Preços e cadastre o preço
-- real de cada uma das 10 linhas novas (3 chapas + 7 isolantes) — todas
-- entram com preço 0, igual sempre foi feito nas revisões de catálogo
-- anteriores (016/017).
-- ============================================================================
