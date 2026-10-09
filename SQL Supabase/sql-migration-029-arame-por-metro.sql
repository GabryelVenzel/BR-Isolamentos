-- ============================================================================
-- BR Isolamentos — Migração 029: arame passa a ser quantificado/precificado
-- por METRO, não mais por peso.
--
-- Pré-requisito: sql-migration-028-renomeia-itens-catalogo.sql já aplicado
-- (é ela que renomeia o item pra "Arame Aço Inox 304 0,9mm" — esta migração
-- só mexe na UNIDADE/fórmula, não no nome). 100% aditiva (a coluna antiga
-- não é removida) e idempotente.
--
-- DECISÃO DE PROJETO: pedido explícito do usuário pra trocar a unidade de
-- venda do arame de kg pra metro — isso muda a FÓRMULA de quantificação
-- (lib/usecases/orcamento/quantificarMateriais.ts), não é só um rótulo:
-- `config_empresa.arame_gramas_por_m2` (gramas de arame por m² de trecho)
-- vira `arame_metros_por_m2` (metros de arame por m² de trecho). A coluna
-- antiga fica no schema (@deprecated, ver lib/types.ts) só por
-- compatibilidade — a aplicação não lê/escreve mais nela.
--
-- CONVERSÃO INICIAL (pra não zerar a quantificação de quem já tinha
-- `arame_gramas_por_m2` configurado): estimada pela massa linear real de um
-- fio de aço inox 304 com 0,9mm de diâmetro —
--   área da seção = π × (0,00045m)² ≈ 6,362e-7 m²
--   densidade do inox 304 ≈ 8000 kg/m³
--   massa por metro ≈ 6,362e-7 × 8000 ≈ 0,00509 kg/m = 5,09 g/m
-- Então metros_por_m2 ≈ gramas_por_m2 ÷ 5,09. É uma ESTIMATIVA de
-- transição baseada em física do material, não um dado do usuário — revise
-- em Configurar Preços e ajuste se o fio real usado tiver outra densidade/
-- diâmetro efetivo (o valor "0,9mm" já veio do próprio pedido de rename).
-- ============================================================================

alter table config_empresa add column if not exists arame_metros_por_m2 numeric(10, 4) not null default 0;

update config_empresa
set arame_metros_por_m2 = round((arame_gramas_por_m2 / 5.09)::numeric, 4)
where arame_metros_por_m2 = 0 and arame_gramas_por_m2 > 0;

update precos_config
set especificacao = 'Por metro', unidade = 'm'
where tipo_material = 'acessorio_arame';

-- ============================================================================
-- Como aplicar: cole este arquivo inteiro no SQL Editor do Supabase e rode.
--
-- IMPORTANTE: depois de rodar, confira o valor de "Arame por m²" em
-- Configurar Preços — a conversão acima é uma estimativa de transição,
-- ajuste se precisar (ex.: fio com diâmetro/densidade diferente do
-- assumido aqui).
--
-- Verificação rápida:
--   select arame_gramas_por_m2, arame_metros_por_m2 from config_empresa;
--   select descricao, especificacao, unidade from precos_config where tipo_material = 'acessorio_arame';
-- ============================================================================
