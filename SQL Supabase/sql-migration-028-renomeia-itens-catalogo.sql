-- ============================================================================
-- BR Isolamentos — Migração 028: renomeia itens do catálogo comercial
-- (Configurar Preços).
--
-- Pré-requisito: sql-migration-027-categoria-parceiro-tipos-trabalho.sql já
-- aplicado. 100% aditiva (só UPDATE em linhas já existentes) e idempotente
-- (rodar de novo não muda nada — os valores novos já batem).
--
-- DECISÕES DE PROJETO:
--
-- 1) Feltro de Lã de Rocha 64kg/m³ 51mm -> 50mm: não é só cosmético — o
--    `espessura_mm` desta linha também muda de 51 pra 50, porque
--    `comporCamadasIsolante` (lib/usecases/orcamento/composicaoIsolante.ts,
--    migração 025) usa esse número pra montar a composição em camadas.
--    Com 51mm, uma espessura exigida de 75mm compunha 51+25=76mm (1mm de
--    sobra); com 50mm vira 50+25=75mm exato — bate com o próprio exemplo
--    que o usuário deu quando pediu a composição em camadas ("75mm = 50mm +
--    25mm"). Some com a linha de 25mm da mesma família sem conflito (a
--    família passa a ter espessuras {25, 50}, sem duplicata).
--
-- 2) Rebite/Silicone: renomeia só `descricao` (texto exibido) — não mudam
--    `unidade`/`especificacao`/quantificação, continuam "Por centena"/
--    "frasco" exatamente como antes.
--
-- 3) Arame: renomeia `descricao` pra refletir o material real (Aço Inox 304
--    0,9mm, não mais "Galvanizado" genérico) — a troca de UNIDADE (kg ->
--    metro) pedida junto NÃO está nesta migração: a quantificação de arame
--    hoje é inteiramente por PESO (`arame_gramas_por_m2` em
--    ConfigEmpresa, ver lib/usecases/orcamento/quantificarMateriais.ts) —
--    mudar a unidade de venda pra metro exige trocar essa fórmula de peso
--    pra comprimento, não é só um rótulo. Fica pendente de confirmação
--    (ver resposta do usuário) antes de mexer no motor de cálculo.
-- ============================================================================

update precos_config
set descricao = 'Feltro de Lã de Rocha 64kg/m³ 50mm', espessura_mm = 50
where tipo_material = 'isolante_la_rocha' and familia = 'Feltro de Lã de Rocha 64kg/m³' and espessura_mm = 51;

update precos_config set descricao = 'Rebite de Alumínio' where tipo_material = 'acessorio_rebite';

update precos_config set descricao = 'Silicone Frasco 300g' where tipo_material = 'acessorio_silicone';

update precos_config set descricao = 'Arame Aço Inox 304 0,9mm' where tipo_material = 'acessorio_arame';

-- ============================================================================
-- Como aplicar: cole este arquivo inteiro no SQL Editor do Supabase e rode.
--
-- Verificação rápida:
--   select tipo_material, descricao, espessura_mm from precos_config
--   where tipo_material in ('isolante_la_rocha', 'acessorio_rebite', 'acessorio_silicone', 'acessorio_arame')
--   order by tipo_material, ordem;
-- ============================================================================
