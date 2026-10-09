-- ============================================================================
-- BR Isolamentos — Migração 010: fluxo de Orçamento com Escopo (metragem
-- automática), catálogo de materiais por m² (isolante + chaparia) e
-- precificação por trecho.
--
-- Pré-requisito: sql-migration-009-financeiro-completo.sql já aplicado.
-- 100% aditiva e idempotente, mesmas regras dos arquivos anteriores.
--
-- DECISÕES DE PROJETO (leia antes de aplicar):
--
-- 1) NÃO existe `precos_config_v2`/`orcamentos_v2`/`orcamento_trechos` como o
--    pedido sugeria. `precos_config` é reaproveitada (catálogo trocado, ver
--    decisão 2) e `itens_orcamento` — que já é, desde o schema original, "um
--    trecho técnico por linha, suporta orçamento misto" — ganha as colunas
--    novas de Escopo/precificação em vez de nascer uma tabela paralela.
--    `orcamentos` (cabeçalho) não muda: `numero_orcamento` (O00001) já existe
--    desde a migração 008.
--
-- 2) `precos_config`: os 7 tipos antigos (manta/chapa/arame/rebite/parafuso/
--    vedacao/vedacit — o "Método Expert" em kg, cf. lib/quantificador.ts)
--    ESTÃO SENDO DESCONTINUADOS para orçamentos NOVOS, por pedido explícito e
--    confirmado do usuário: preço fixo em R$/m² só para isolante e chaparia,
--    sem detalhar fixadores/vedação. Isso é seguro porque `itens_orcamento`
--    já grava o próprio `valor_materiais` (e os kg individuais) no momento da
--    criação — orçamentos ANTIGOS não fazem lookup ao vivo em `precos_config`
--    depois de criados, então trocar o conteúdo dessa tabela não corrompe
--    nada já salvo. `lib/quantificador.ts` e as colunas antigas de
--    `itens_orcamento` (manta_kg, chapa_kg, rebites, parafusos, arame_kg,
--    vedacao_pu, vedacit_un) são MANTIDOS no código/schema só para exibir
--    orçamentos antigos — o wizard novo não os usa mais.
--
-- 3) Catálogo de MATERIAIS FÍSICOS (`materiais_isolantes`, usado para achar
--    k(T) na física de condução) NÃO foi alterado — são dados pesquisados
--    (materials_internal.py), não posso inventar coeficientes k(T) novos
--    para as densidades comerciais pedidas (Lã de Rocha 50/75/100kg/m³,
--    Espuma 40/50/60kg/m³) sem fonte. O novo catálogo comercial
--    (`precos_config`, preço por m²) tem exatamente as densidades pedidas;
--    a física usa o material JÁ PESQUISADO de densidade mais próxima dentro
--    da mesma categoria (ver lib/usecases/orcamento/materialFisico.ts) —
--    ponte documentada entre "o que já foi medido" e "o que se vende".
--
-- 4) Ponto de orvalho (Frio) CONTINUA calculado a partir de Umidade Relativa
--    do ar via fórmula de Magnus (fiel a CALCULADORA-TERMICA.py) — não foi
--    trocado por um campo de "ponto de orvalho" digitado direto, que exigiria
--    inverter essa fórmula sem uma fonte validada para fazer isso.
-- ============================================================================


-- ============================================================================
-- precos_config — vira catálogo comercial (preço por m²) de chaparia/isolante
-- ============================================================================
alter table precos_config add column if not exists especificacao varchar;
alter table precos_config add column if not exists unidade varchar not null default 'm2';

alter table precos_config drop constraint if exists precos_config_tipo_material_check;
alter table precos_config add constraint precos_config_tipo_material_check
  check (tipo_material in (
    'chaparia_inox', 'chaparia_galvanizado', 'chaparia_aluminio',
    'isolante_fibra_ceramica', 'isolante_la_rocha', 'isolante_espuma'
  ));

-- Os 7 tipos antigos (todos com preço 0, exceto Vedacit — nunca chegaram a
-- ser configurados de verdade pela operação) saem; entra o catálogo novo.
-- Não afeta orçamentos já salvos (ver decisão 2 acima).
delete from precos_config where tipo_material in
  ('manta', 'chapa', 'arame', 'rebite', 'parafuso', 'vedacao', 'vedacit');

insert into precos_config (tipo_material, descricao, especificacao, unidade, preco_unitario, densidade_kg_m3) values
  ('chaparia_inox', 'Chaparia Inox 0,8mm', '0,8mm', 'm2', 0, null),
  ('chaparia_inox', 'Chaparia Inox 1mm', '1mm', 'm2', 0, null),
  ('chaparia_inox', 'Chaparia Inox 1,5mm', '1,5mm', 'm2', 0, null),
  ('chaparia_galvanizado', 'Chaparia Galvanizada 0,8mm', '0,8mm', 'm2', 0, null),
  ('chaparia_galvanizado', 'Chaparia Galvanizada 1mm', '1mm', 'm2', 0, null),
  ('chaparia_galvanizado', 'Chaparia Galvanizada 1,5mm', '1,5mm', 'm2', 0, null),
  ('chaparia_aluminio', 'Chaparia Alumínio 0,8mm', '0,8mm', 'm2', 0, null),
  ('chaparia_aluminio', 'Chaparia Alumínio 1mm', '1mm', 'm2', 0, null),
  ('chaparia_aluminio', 'Chaparia Alumínio 1,5mm', '1,5mm', 'm2', 0, null),
  ('isolante_fibra_ceramica', 'Fibra Cerâmica 64kg/m³', '64kg/m³', 'm2', 0, 64),
  ('isolante_fibra_ceramica', 'Fibra Cerâmica 96kg/m³', '96kg/m³', 'm2', 0, 96),
  ('isolante_fibra_ceramica', 'Fibra Cerâmica 128kg/m³', '128kg/m³', 'm2', 0, 128),
  ('isolante_la_rocha', 'Lã de Rocha 50kg/m³', '50kg/m³', 'm2', 0, 50),
  ('isolante_la_rocha', 'Lã de Rocha 75kg/m³', '75kg/m³', 'm2', 0, 75),
  ('isolante_la_rocha', 'Lã de Rocha 100kg/m³', '100kg/m³', 'm2', 0, 100),
  ('isolante_espuma', 'Espuma Elastomérica 40kg/m³', '40kg/m³', 'm2', 0, 40),
  ('isolante_espuma', 'Espuma Elastomérica 50kg/m³', '50kg/m³', 'm2', 0, 50),
  ('isolante_espuma', 'Espuma Elastomérica 60kg/m³', '60kg/m³', 'm2', 0, 60);


-- ============================================================================
-- itens_orcamento — "trecho": Escopo (itens de área) + precificação por m²
-- ============================================================================

-- Escopo: lista de {id, nome, tipo, diametro_mm?, comprimento_m?, quantidade?,
-- metragemCalculada, metragemManual?, metragemEditada, metragemFinal} — ver
-- lib/usecases/orcamento/escopo.ts. Guardado como jsonb (mesmo padrão de
-- `anexos` em lancamentos_financeiros, migração 009): é o detalhamento que
-- justifica a metragem total do trecho, não precisa de tabela própria.
alter table itens_orcamento add column if not exists escopo_itens jsonb not null default '[]';

-- Especificação comercial escolhida (ex.: "96kg/m³", "0,8mm") — complementa
-- `material`/`acabamento` (que guardam o nome completo, ex. "Fibra Cerâmica
-- 96kg/m³") com o valor isolado, útil pra exibição tabular na proposta.
alter table itens_orcamento add column if not exists especificacao_isolante varchar;
alter table itens_orcamento add column if not exists especificacao_acabamento varchar;

-- Preço por m² travado no momento da criação do trecho (snapshot — mesmo
-- raciocínio de precos_config: se o preço-catálogo mudar depois, orçamentos
-- já criados não devem mudar de valor sozinhos).
alter table itens_orcamento add column if not exists preco_isolante_m2 numeric(10, 2);
alter table itens_orcamento add column if not exists preco_acabamento_m2 numeric(10, 2);

-- Mão de obra é, na engenharia atual, um input manual (não há fórmula
-- validada de "horas por m²" no código-fonte nem nas planilhas) — por
-- trecho, para poder aparecer detalhada na proposta ("Trecho 1: 12h"); a
-- soma de todos os trechos continua alimentando o único
-- `horas_mao_obra` que `calcularOrcamento` já usa (config.valor_hora_mao_obra
-- é global, não por trecho).
alter table itens_orcamento add column if not exists horas_mao_obra numeric(8, 2) not null default 0;

alter table itens_orcamento add column if not exists subtotal_material numeric(12, 2) not null default 0;
alter table itens_orcamento add column if not exists subtotal_mao_obra numeric(12, 2) not null default 0;


-- ============================================================================
-- Como aplicar: cole este arquivo inteiro no SQL Editor do Supabase e rode.
--
-- Verificação rápida:
--   select tipo_material, especificacao, preco_unitario from precos_config order by tipo_material;
--   select escopo_itens, preco_isolante_m2, horas_mao_obra from itens_orcamento limit 1;
-- ============================================================================
