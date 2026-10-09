-- ============================================================================
-- BR Isolamentos — Migração 017: ordem explícita do catálogo de preços
-- (chaparia fina→grossa, isolante menor→maior densidade) + item "Rebite".
--
-- Pré-requisito: sql-migration-016-catalogo-precos-revisado.sql já aplicado.
-- Idempotente.
--
-- DECISÃO: em vez de confiar na ordem de inserção das linhas (frágil — o
-- Postgres não garante isso sem um ORDER BY, mesmo que hoje "funcione por
-- coincidência" porque os números de especificação ordenam certo como
-- texto), adiciona uma coluna `ordem` explícita. A tela (FormPrecos.tsx)
-- passa a ordenar por ela dentro de cada grupo, e os grupos "Materiais
-- Adicionais" (Arame/Parafusos/Rebite/Silicone) passam a aparecer juntos
-- numa seção só, no fim da lista — não mais um cabeçalho por item.
-- ============================================================================

alter table precos_config add column if not exists ordem int not null default 0;

-- Chaparia: fina -> grossa (1 a 4, mesma ordem nos 3 tipos)
update precos_config set ordem = 1 where tipo_material like 'chaparia_%' and especificacao = '0,45mm';
update precos_config set ordem = 2 where tipo_material like 'chaparia_%' and especificacao = '0,60mm';
update precos_config set ordem = 3 where tipo_material like 'chaparia_%' and especificacao = '0,75mm';
update precos_config set ordem = 4 where tipo_material like 'chaparia_%' and especificacao = '1mm';

-- Isolante: menor -> maior densidade
update precos_config set ordem = 1 where tipo_material = 'isolante_la_rocha' and especificacao = '40kg/m³';
update precos_config set ordem = 2 where tipo_material = 'isolante_la_rocha' and especificacao = '48kg/m³';
update precos_config set ordem = 3 where tipo_material = 'isolante_la_rocha' and especificacao = '64kg/m³';
update precos_config set ordem = 4 where tipo_material = 'isolante_la_rocha' and especificacao = '96kg/m³';

update precos_config set ordem = 1 where tipo_material = 'isolante_fibra_ceramica' and especificacao = '32kg/m³';
update precos_config set ordem = 2 where tipo_material = 'isolante_fibra_ceramica' and especificacao = '48kg/m³';
update precos_config set ordem = 3 where tipo_material = 'isolante_fibra_ceramica' and especificacao = '64kg/m³';
update precos_config set ordem = 4 where tipo_material = 'isolante_fibra_ceramica' and especificacao = '96kg/m³';

update precos_config set ordem = 1 where tipo_material = 'isolante_espuma';

-- Materiais adicionais: Arame, Parafusos, Rebite, Silicone (nessa ordem)
update precos_config set ordem = 1 where tipo_material = 'acessorio_arame';
update precos_config set ordem = 2 where tipo_material = 'acessorio_parafuso';
update precos_config set ordem = 4 where tipo_material = 'acessorio_silicone';

alter table precos_config drop constraint if exists precos_config_tipo_material_check;
alter table precos_config add constraint precos_config_tipo_material_check
  check (tipo_material in (
    'chaparia_inox', 'chaparia_galvanizado', 'chaparia_aluminio',
    'isolante_fibra_ceramica', 'isolante_la_rocha', 'isolante_espuma',
    'acessorio_arame', 'acessorio_parafuso', 'acessorio_rebite', 'acessorio_silicone'
  ));

-- Rebite (novo item — mesma precificação por centena de Parafusos).
insert into precos_config (tipo_material, descricao, especificacao, unidade, preco_unitario, densidade_kg_m3, ordem)
select 'acessorio_rebite', 'Rebite', 'Por centena', 'centena', 0, null, 3
where not exists (select 1 from precos_config where tipo_material = 'acessorio_rebite');


-- ============================================================================
-- Como aplicar: cole este arquivo inteiro no SQL Editor do Supabase e rode.
--
-- Verificação rápida:
--   select tipo_material, especificacao, ordem from precos_config order by tipo_material, ordem;
-- ============================================================================
