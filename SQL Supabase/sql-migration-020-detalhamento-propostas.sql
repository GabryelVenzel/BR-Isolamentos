-- ============================================================================
-- BR Isolamentos — Migração 020: detalhamento de materiais por trecho
-- (persistido, para a Proposta Comercial) + condições comerciais e
-- projeções configuráveis exibidas nas Propostas Técnica/Comercial.
--
-- Pré-requisito: sql-migration-019-motor-quantificacao-mao-obra.sql já aplicado.
-- 100% aditiva e idempotente.
--
-- DECISÕES DE PROJETO (leia antes de aplicar — desvios do pedido original):
--
-- 1) O pedido ("PROPOSTAS TÉCNICA E COMERCIAL ELABORADAS") pede uma tabela de
--    quantificação de materiais (Isolante/Acabamento/Rebite/Parafuso/Arame/
--    Silicone, com quantidade/preço/subtotal editáveis) dentro da Proposta
--    Comercial gerada. Essa tabela já existe na Tela 4 do wizard — mas a
--    migração 019 decidiu deliberadamente (decisão 3, no arquivo daquela
--    migração) NÃO persistir esse detalhamento campo a campo, só o agregado
--    (`subtotal_material`). Isso significa que, sem mudança de schema, a
--    Proposta Comercial de um orçamento JÁ SALVO não teria como reconstruir
--    aquela tabela — só o total. `itens_orcamento.detalhamento_materiais`
--    (jsonb) resolve isso: grava a mesma lista de linhas mostrada na Tela 4,
--    já com o preço final aplicado (inclui overrides feitos no lápis),
--    travada no momento da criação do trecho — mesmo princípio de
--    `preco_isolante_m2`/`preco_acabamento_m2` (não recalcula sozinho se o
--    catálogo mudar depois). Orçamentos "somente_mo" e orçamentos criados
--    antes desta migração ficam com `[]` (a Proposta cai de volta no resumo
--    agregado nesses casos).
--
-- 2) Os números específicos citados no pedido (desconto de 5% à vista,
--    garantia de 12 meses, reajuste tarifário de 3% a.a. na projeção de 10
--    anos, equivalência de CO₂ em árvores) NÃO foram hardcoded no template
--    do PDF/Word — viraram colunas em `config_empresa`, com o valor citado
--    no pedido como default, editável em Configurar Preços (mesmo padrão já
--    usado pra todo parâmetro de precificação/quantificação). Isso evita
--    fixar no código um número de política comercial (desconto, garantia,
--    projeção financeira) que deveria poder mudar sem deploy — e deixa
--    explícito que a projeção de 10 anos com reajuste tarifário é uma
--    ESTIMATIVA configurável, não uma promessa fixa embutida no gerador.
--
-- 3) NÃO foram criados campos de "forma de pagamento", "prazo de execução"
--    ou os textos de garantia de materiais/exclusões/responsabilidades do
--    pedido — esses viraram texto padrão (boilerplate) escrito direto nos
--    templates das Propostas (components/pdf-native/*, lib/docx-generator.ts),
--    reaproveitando literalmente as opções do próprio pedido. O prazo de
--    execução é CALCULADO a partir de `horas_mao_obra`/`horas_uteis_dia` (já
--    existentes), não precisa de campo novo. Transformar cada cláusula
--    comercial fixa em configuração editável ficaria fora do escopo desta
--    migração — sinalizado aqui como possível follow-up caso a empresa
--    precise ajustar esses textos com frequência.
-- ============================================================================

alter table itens_orcamento add column if not exists detalhamento_materiais jsonb not null default '[]'::jsonb;

alter table config_empresa add column if not exists desconto_avista_percentual numeric(5,2) not null default 5.00;
alter table config_empresa add column if not exists garantia_mao_obra_meses integer not null default 12;
alter table config_empresa add column if not exists projecao_reajuste_tarifario_percentual numeric(5,2) not null default 3.00;
alter table config_empresa add column if not exists co2_kg_por_arvore_ano numeric(6,2) not null default 22.00;

-- ============================================================================
-- Como aplicar: cole este arquivo inteiro no SQL Editor do Supabase e rode.
--
-- Verificação rápida:
--   select detalhamento_materiais from itens_orcamento limit 1;
--   select desconto_avista_percentual, garantia_mao_obra_meses,
--          projecao_reajuste_tarifario_percentual, co2_kg_por_arvore_ano
--   from config_empresa;
-- ============================================================================
