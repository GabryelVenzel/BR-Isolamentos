-- ============================================================================
-- BR Isolamentos — Migração 019: motor de quantificação de materiais +
-- mão de obra automática (fatores de eficiência) + tipo de proposta.
--
-- Pré-requisito: sql-migration-018-fix-trigger-precos-config.sql já aplicado.
-- 100% aditiva e idempotente.
--
-- DECISÕES DE PROJETO (leia antes de aplicar — desvios do pedido original):
--
-- 1) NÃO existe painel `/orcamento/parametros` com login/senha própria
--    (bcrypt) nem tabela `parametros_orcamento`/`parametros_audit_log`
--    separadas. Os parâmetros novos (acréscimos de material, fatores de
--    eficiência de mão de obra) entram como colunas em `config_empresa` —
--    a mesma tabela de configuração única já usada pra margem/impostos/
--    custos operacionais, editada na MESMA tela Configurar Preços (que já
--    fica atrás do login normal do sistema, igual toda outra tela interna).
--    Criar um segundo sistema de autenticação (senha própria, hash bcrypt,
--    sessão separada) só pra esta tela seria uma superfície de segurança
--    nova e duplicada, sem reaproveitar a autenticação (Supabase Auth) que
--    já protege o resto do app.
--
-- 2) NÃO existem os campos manuais `tem_curvas`/`tubuacao_pequena` no
--    trecho. Essas duas informações já existem no Escopo de cada trecho
--    (`itens_orcamento.escopo_itens`, jsonb — ver lib/usecases/orcamento/
--    escopo.ts): um item de escopo já é `tipo: 'curva'` ou tem
--    `diametro_mm`. Pedir de novo como checkbox manual duplicaria dado já
--    coletado (e poderia divergir do escopo real). `trabalho_altura` É um
--    campo novo de verdade — não existe nenhum proxy pra "trabalho acima de
--    2 metros" no escopo atual.
--
-- 3) Preço final de cada trecho continua salvo só como totais
--    (`subtotal_material`, já existente) — as quantidades individuais de
--    cada material (isolante em m² com acréscimo, rebites, parafusos,
--    arame, silicone) são CALCULADAS na hora (Tela 4), não persistidas
--    campo a campo. Mesma lógica já usada pra `preco_isolante_m2`/
--    `preco_acabamento_m2`: só o que é editável/override é gravado, o que é
--    puramente derivado (metragem × parâmetro) não precisa de coluna própria.
--
-- 4) "Outro material" (isolante/acabamento customizado) reaproveita as
--    colunas que já existem — `material`/`acabamento` (nome livre) e
--    `preco_isolante_m2`/`preco_acabamento_m2` (preço/m², já pensado como
--    "override só deste orçamento"). Nenhuma coluna nova precisa disso.
-- ============================================================================

-- config_empresa: parâmetros de quantificação de material + mão de obra
alter table config_empresa add column if not exists isolante_acrescimo_percentual numeric(5,2) not null default 20.00;
alter table config_empresa add column if not exists acabamento_acrescimo_percentual numeric(5,2) not null default 30.00;
alter table config_empresa add column if not exists rebite_por_m2 numeric(6,2) not null default 20;
alter table config_empresa add column if not exists parafusos_por_m2 numeric(6,2) not null default 20;
alter table config_empresa add column if not exists arame_gramas_por_m2 numeric(8,2) not null default 500;
-- "a cada X m² usa 1 frasco de silicone" — o tamanho do frasco em si
-- (300g) é só informativo na tela, não entra em nenhuma fórmula.
alter table config_empresa add column if not exists silicone_intervalo_m2 numeric(6,2) not null default 2.00;

alter table config_empresa add column if not exists m2_por_hora_dupla numeric(5,2) not null default 2.00;
alter table config_empresa add column if not exists eficiencia_tubulacao_pequena numeric(4,2) not null default 0.75;
alter table config_empresa add column if not exists eficiencia_curva numeric(4,2) not null default 0.75;
alter table config_empresa add column if not exists eficiencia_altura numeric(4,2) not null default 0.50;
alter table config_empresa add column if not exists eficiencia_fator_br numeric(4,2) not null default 0.80;
alter table config_empresa add column if not exists horas_uteis_dia numeric(4,2) not null default 9;

-- orcamentos: tipo de proposta (Material+MO vs Somente MO)
alter table orcamentos add column if not exists tipo_proposta varchar not null default 'material_mo';
alter table orcamentos drop constraint if exists orcamentos_tipo_proposta_check;
alter table orcamentos add constraint orcamentos_tipo_proposta_check
  check (tipo_proposta in ('material_mo', 'somente_mo'));

-- itens_orcamento: trabalho em altura (novo — sem proxy no escopo atual) +
-- eficiência global aplicada (cache, só para exibição/auditoria na proposta).
alter table itens_orcamento add column if not exists trabalho_altura boolean not null default false;
alter table itens_orcamento add column if not exists eficiencia_global numeric(6,4);


-- ============================================================================
-- Como aplicar: cole este arquivo inteiro no SQL Editor do Supabase e rode.
--
-- Verificação rápida:
--   select isolante_acrescimo_percentual, m2_por_hora_dupla, eficiencia_altura from config_empresa;
--   select tipo_proposta from orcamentos limit 1;
--   select trabalho_altura, eficiencia_global from itens_orcamento limit 1;
-- ============================================================================
