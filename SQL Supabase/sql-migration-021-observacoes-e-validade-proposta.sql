-- ============================================================================
-- BR Isolamentos — Migração 021: observações adicionais do orçamento +
-- validade/forma de pagamento configuráveis da Proposta.
--
-- Pré-requisito: sql-migration-020-detalhamento-propostas.sql já aplicado.
-- 100% aditiva e idempotente.
--
-- DECISÕES DE PROJETO (leia antes de aplicar — desvios do pedido original):
--
-- 1) O pedido ("REFATORAÇÃO PROPOSTAS TÉCNICA E COMERCIAL") descreve rotas e
--    arquivos que não existem neste projeto (ex.: app/orcamento/etapas/...,
--    app/configuracoes/operacional/page.tsx, lib/geradores/proposta-*.ts,
--    componentes em Tailwind com <img>/gradiente/"page-break"). A arquitetura
--    real gera as Propostas com @react-pdf/renderer (components/pdf-native/*,
--    primitivos View/Text/Image próprios, sem Tailwind) + docx
--    (lib/docx-generator.ts), no wizard real de 5 telas
--    (app/novo-orcamento/step-1-cliente..step-5-revisao) e na configuração
--    já existente em Configurar Preços (FormConfigEmpresa.tsx,
--    `config_empresa`) — não em duas páginas novas de admin. Esta migração e
--    o código desta rodada foram adaptados pra essa arquitetura real, não
--    pra estrutura de arquivos assumida no pedido.
--
-- 2) NÃO foram criadas colunas `aliquota_impostos`/`taxa_margem_padrao` —
--    já existem como `impostos_config` (tabela) e
--    `config_empresa.margem_lucro_padrao` desde o início do projeto.
--
-- 3) NÃO foi criado `prazo_execucao_dias` configurável — o prazo de
--    execução já é CALCULADO a partir da mão de obra automática de cada
--    trecho (`prazoExecucaoDiasUteis`, lib/usecases/orcamento/
--    analiseProposta.ts, migração 020) e é mais preciso que um número fixo
--    igual pra todo orçamento.
-- ============================================================================

alter table orcamentos add column if not exists observacoes_adicionais text;

alter table config_empresa add column if not exists validade_proposta_dias integer not null default 30;
alter table config_empresa add column if not exists forma_pagamento_padrao text not null default '50% de entrada + 50% na conclusão dos trabalhos';

-- ============================================================================
-- Como aplicar: cole este arquivo inteiro no SQL Editor do Supabase e rode.
--
-- Verificação rápida:
--   select observacoes_adicionais from orcamentos limit 1;
--   select validade_proposta_dias, forma_pagamento_padrao from config_empresa;
-- ============================================================================
