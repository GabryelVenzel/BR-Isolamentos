-- ============================================================================
-- BR Isolamentos — Migração 016: revisão do catálogo comercial de preços
-- (espessuras/densidades corretas) + materiais adicionais (arame/parafusos/
-- silicone).
--
-- Pré-requisito: sql-migration-015-fornecedor-tipos-multiplos.sql já
-- aplicado. Idempotente.
--
-- DECISÕES DE PROJETO (leia antes de aplicar):
--
-- 1) Chaparia (Inox/Galvanizada/Alumínio) e os isolantes (Fibra Cerâmica/Lã
--    de Rocha) trocam de espessuras/densidades — as antigas são REMOVIDAS e
--    as novas entram com preço 0 (a definir pelo usuário na tela Configurar
--    Preços), mesmo padrão da migração 010 que criou essas linhas. Isso não
--    corrompe orçamentos já criados: o preço é travado (snapshot) no
--    trecho no momento da criação, `precos_config` não é consultada de novo
--    depois (ver decisão 2 em sql-migration-010).
--
-- 2) Espuma Elastomérica é o único caso onde uma densidade sobrevive sem
--    mudar (50kg/m³) — só remove 40 e 60, preserva a linha de 50kg/m³ como
--    está (com o preço que já tiver sido cadastrado), em vez de recriar.
--
-- 3) A física do cálculo térmico (materiais_isolantes, lib/usecases/
--    orcamento/materialFisico.ts) NÃO precisa mudar — ela já casa a
--    densidade comercial escolhida com o material pesquisado de densidade
--    mais próxima dentro da mesma categoria (arquitetura feita exatamente
--    pra não exigir que as densidades comercial/física batam 1:1). Nenhuma
--    calculadora precisa de ajuste.
--
-- 4) Materiais adicionais (Arame/Parafusos/Silicone vidro): reverte a
--    decisão da migração 010 de excluir fixadores/vedação do catálogo
--    comercial ("Sem detalhamento de fixadores/vedação") — agora entram
--    de volta, mas como 3 tipos NOVOS (`acessorio_arame`/`acessorio_
--    parafuso`/`acessorio_silicone`), não reaproveitando os tipos antigos
--    `arame`/`parafuso`/`vedacit` do "Método Expert" (que continuam
--    reservados só pra tipar o detalhamento de orçamentos ANTIGOS, ver
--    comentário em lib/types.ts). Preço em unidade PRÓPRIA (kg/centena/
--    frasco), não m² — `precos_config.unidade` já era uma coluna livre,
--    só o catálogo novo até agora só tinha usado "m2".
-- ============================================================================

alter table precos_config drop constraint if exists precos_config_tipo_material_check;
alter table precos_config add constraint precos_config_tipo_material_check
  check (tipo_material in (
    'chaparia_inox', 'chaparia_galvanizado', 'chaparia_aluminio',
    'isolante_fibra_ceramica', 'isolante_la_rocha', 'isolante_espuma',
    'acessorio_arame', 'acessorio_parafuso', 'acessorio_silicone'
  ));

-- Chaparia: 0,8/1/1,5mm -> 0,45/0,60/0,75/1mm (decisão 1)
delete from precos_config where tipo_material in ('chaparia_inox', 'chaparia_galvanizado', 'chaparia_aluminio');
insert into precos_config (tipo_material, descricao, especificacao, unidade, preco_unitario, densidade_kg_m3) values
  ('chaparia_inox', 'Chaparia Inox 0,45mm', '0,45mm', 'm2', 0, null),
  ('chaparia_inox', 'Chaparia Inox 0,60mm', '0,60mm', 'm2', 0, null),
  ('chaparia_inox', 'Chaparia Inox 0,75mm', '0,75mm', 'm2', 0, null),
  ('chaparia_inox', 'Chaparia Inox 1mm', '1mm', 'm2', 0, null),
  ('chaparia_galvanizado', 'Chaparia Galvanizada 0,45mm', '0,45mm', 'm2', 0, null),
  ('chaparia_galvanizado', 'Chaparia Galvanizada 0,60mm', '0,60mm', 'm2', 0, null),
  ('chaparia_galvanizado', 'Chaparia Galvanizada 0,75mm', '0,75mm', 'm2', 0, null),
  ('chaparia_galvanizado', 'Chaparia Galvanizada 1mm', '1mm', 'm2', 0, null),
  ('chaparia_aluminio', 'Chaparia Alumínio 0,45mm', '0,45mm', 'm2', 0, null),
  ('chaparia_aluminio', 'Chaparia Alumínio 0,60mm', '0,60mm', 'm2', 0, null),
  ('chaparia_aluminio', 'Chaparia Alumínio 0,75mm', '0,75mm', 'm2', 0, null),
  ('chaparia_aluminio', 'Chaparia Alumínio 1mm', '1mm', 'm2', 0, null);

-- Fibra Cerâmica: 64/96/128kg/m³ -> 32/48/64/96kg/m³ (decisão 1)
delete from precos_config where tipo_material = 'isolante_fibra_ceramica';
insert into precos_config (tipo_material, descricao, especificacao, unidade, preco_unitario, densidade_kg_m3) values
  ('isolante_fibra_ceramica', 'Fibra Cerâmica 32kg/m³', '32kg/m³', 'm2', 0, 32),
  ('isolante_fibra_ceramica', 'Fibra Cerâmica 48kg/m³', '48kg/m³', 'm2', 0, 48),
  ('isolante_fibra_ceramica', 'Fibra Cerâmica 64kg/m³', '64kg/m³', 'm2', 0, 64),
  ('isolante_fibra_ceramica', 'Fibra Cerâmica 96kg/m³', '96kg/m³', 'm2', 0, 96);

-- Lã de Rocha: 50/75/100kg/m³ -> 40/48/64/96kg/m³ (decisão 1)
delete from precos_config where tipo_material = 'isolante_la_rocha';
insert into precos_config (tipo_material, descricao, especificacao, unidade, preco_unitario, densidade_kg_m3) values
  ('isolante_la_rocha', 'Lã de Rocha 40kg/m³', '40kg/m³', 'm2', 0, 40),
  ('isolante_la_rocha', 'Lã de Rocha 48kg/m³', '48kg/m³', 'm2', 0, 48),
  ('isolante_la_rocha', 'Lã de Rocha 64kg/m³', '64kg/m³', 'm2', 0, 64),
  ('isolante_la_rocha', 'Lã de Rocha 96kg/m³', '96kg/m³', 'm2', 0, 96);

-- Espuma Elastomérica: remove 40 e 60kg/m³, preserva a linha de 50kg/m³
-- como está (decisão 2 — não recria, não reseta o preço já cadastrado).
delete from precos_config where tipo_material = 'isolante_espuma' and especificacao in ('40kg/m³', '60kg/m³');

-- Materiais adicionais — Arame/Parafusos/Silicone vidro (decisão 4).
-- Idempotente: só insere se ainda não existir uma linha com essa
-- especificação (permite rodar de novo sem duplicar).
insert into precos_config (tipo_material, descricao, especificacao, unidade, preco_unitario, densidade_kg_m3)
select 'acessorio_arame', 'Arame Galvanizado', 'Por kg', 'kg', 0, null
where not exists (select 1 from precos_config where tipo_material = 'acessorio_arame');

insert into precos_config (tipo_material, descricao, especificacao, unidade, preco_unitario, densidade_kg_m3)
select 'acessorio_parafuso', 'Parafusos Diversos', 'Por centena', 'centena', 0, null
where not exists (select 1 from precos_config where tipo_material = 'acessorio_parafuso');

insert into precos_config (tipo_material, descricao, especificacao, unidade, preco_unitario, densidade_kg_m3)
select 'acessorio_silicone', 'Silicone Vidro', 'Frasco 300g', 'frasco', 0, null
where not exists (select 1 from precos_config where tipo_material = 'acessorio_silicone');


-- ============================================================================
-- Como aplicar: cole este arquivo inteiro no SQL Editor do Supabase e rode.
--
-- Verificação rápida:
--   select tipo_material, especificacao, preco_unitario, unidade from precos_config order by tipo_material, especificacao;
-- ============================================================================
