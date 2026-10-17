-- ============================================================================
-- Migração 056 — Encargos sobre a mão de obra (MEI, PF/RPA, PJ) e Supervisor
-- ============================================================================
-- Especificação: "0.Arquivos BR Isolamentos/07 - Sistema/Direcionamento_
-- Encargos_Mao_de_Obra_Orcamento.docx" (17/10/2026).
--
-- O que muda:
--
--   1. config_empresa — parâmetros dos encargos (valores de 2026; mudam todo
--      ano e ficam editáveis em Configurações do orçamento):
--        encargos_inss_pf_pct ............ 11      INSS descontado da pessoa física
--        encargos_teto_inss .............. 8475,55 teto mensal da base do INSS
--        encargos_cpp_pct ................ 20      INSS patronal (PF fora do Anexo III; MEI do art. 18-B)
--        encargos_tabela_irrf ............ tabela mensal do IR (JSON)
--        encargos_irrf_desconto_simplificado 607,20
--        encargos_reducao_irrf ........... redução da Lei 15.270/2025 (JSON, ligada)
--        encargos_iss_autonomo_pct ....... 0       ISS sobre autônomo, se o município exigir
--        encargos_dias_trabalho_mes ...... 22      tamanho do bloco mensal do cálculo
--        forma_contratacao_padrao ........ forma que vem preenchida em cada função (pessoa física)
--        simples_nacional_rbt12_atualizado_em    data da última revisão do RBT12
--
--   2. Novo cargo SUPERVISOR: valor_diaria_supervisor e m2_dia_supervisor
--      (ele produz). Começam em 0 — CADASTRE os valores em Configurações.
--
--   3. parceiros.forma_contratacao (mei, pf, pj, mei_cpp): como cada prestador
--      é contratado (base para o RPA e o relatório ao contador).
--
--   A equipe de cada orçamento (orcamentos.mao_obra_equipe, JSON) passa a
--   guardar a forma de contratação, o bruto, o INSS, o IR, o INSS patronal e o
--   custo real de cada linha. Orçamentos antigos continuam abrindo com o mesmo
--   valor (forma "não informada", sem encargos) — não há alteração de dados.
--
-- ORDEM: rodar ANTES de publicar o código deste bloco. É seguro rodar com a
-- versão atual do site no ar.
--
-- Idempotente — pode rodar mais de uma vez.
-- ============================================================================

-- 1. Parâmetros dos encargos
alter table config_empresa add column if not exists encargos_inss_pf_pct numeric(6, 3) not null default 11;
alter table config_empresa add column if not exists encargos_teto_inss numeric(12, 2) not null default 8475.55;
alter table config_empresa add column if not exists encargos_cpp_pct numeric(6, 3) not null default 20;
alter table config_empresa add column if not exists encargos_tabela_irrf jsonb not null default
  '[{"ate":2428.80,"aliquota":0,"deducao":0},
    {"ate":2826.65,"aliquota":7.5,"deducao":182.16},
    {"ate":3751.05,"aliquota":15,"deducao":394.16},
    {"ate":4664.68,"aliquota":22.5,"deducao":675.49},
    {"ate":null,"aliquota":27.5,"deducao":908.73}]'::jsonb;
alter table config_empresa add column if not exists encargos_irrf_desconto_simplificado numeric(12, 2) not null default 607.20;
alter table config_empresa add column if not exists encargos_reducao_irrf jsonb not null default
  '{"ativa":true,"isencao_ate":5000,"reducao_ate":7350,"constante":978.62,"coeficiente":0.133145}'::jsonb;
alter table config_empresa add column if not exists encargos_iss_autonomo_pct numeric(6, 3) not null default 0;
alter table config_empresa add column if not exists encargos_dias_trabalho_mes integer not null default 22;
alter table config_empresa add column if not exists forma_contratacao_padrao jsonb not null default
  '{"funileiro":"pf","isolador":"pf","ajudante":"pf","supervisor":"pf","tst":"pf"}'::jsonb;
alter table config_empresa add column if not exists simples_nacional_rbt12_atualizado_em date default current_date;

-- 2. Supervisor
alter table config_empresa add column if not exists valor_diaria_supervisor numeric(10, 2) not null default 0;
alter table config_empresa add column if not exists m2_dia_supervisor numeric(10, 2) not null default 0;

-- 3. Forma de contratação do prestador
alter table parceiros add column if not exists forma_contratacao varchar;
alter table parceiros drop constraint if exists parceiros_forma_contratacao_check;
alter table parceiros add constraint parceiros_forma_contratacao_check
  check (forma_contratacao is null or forma_contratacao in ('mei', 'pf', 'pj', 'mei_cpp'));

-- ============================================================================
-- VERIFICAÇÃO
--
--   select encargos_inss_pf_pct, encargos_teto_inss, encargos_cpp_pct,
--          encargos_reducao_irrf, forma_contratacao_padrao,
--          valor_diaria_supervisor, m2_dia_supervisor,
--          simples_nacional_rbt12_atualizado_em
--     from config_empresa;
-- ============================================================================
