-- ============================================================================
-- Migração 048 — Mão de obra do orçamento por equipe e diárias
-- ============================================================================
-- Até aqui a mão de obra do orçamento era "horas de uma dupla × valor/hora".
-- Passa a ser por EQUIPE e por DIÁRIA:
--
--   - três funções — funileiro, isolador e ajudante —, cada uma com o seu
--     valor de diária e o seu rendimento (m² por pessoa por dia);
--   - em cada proposta escolhe-se quantas pessoas de cada função;
--   - as horas de obra continuam sendo calculadas (metragem ÷ eficiência ÷
--     produção da equipe) e são sempre arredondadas PARA CIMA em dias
--     fechados de 7 h úteis; cada pessoa da equipe é cobrada por esses dias.
--     Ex.: 82 h de obra ÷ 7 h = 11,7 → 12 diárias de cada pessoa.
--
-- O que muda no banco:
--   1. `config_empresa`: valor de diária e rendimento de cada função.
--   2. `config_empresa.horas_uteis_dia` passa a 7 (o dia de trabalho a que os
--      rendimentos se referem).
--   3. `orcamentos.mao_obra_equipe`: a equipe, os dias e os valores de cada
--      proposta nova (as Propostas mostram a equipe e as diárias a partir
--      daqui). Orçamentos já existentes ficam sem esse dado e continuam sendo
--      exibidos no formato antigo (horas por trecho).
--
-- VALORES INICIAIS — CONFIRA EM "CONFIGURAR PREÇOS" DEPOIS DE RODAR:
--   Para não deixar tudo zerado, funileiro e isolador nascem com o
--   equivalente ao que estava cadastrado para a dupla, convertido para uma
--   pessoa em um dia de 7 h:
--       diária     = (valor/hora da dupla ÷ 2) × 7
--       rendimento = (m²/hora da dupla ÷ 2) × 7
--   O AJUDANTE NASCE ZERADO (diária e rendimento) — é função nova, não há de
--   onde converter. São só pontos de partida: ajuste os seis valores.
--
-- NADA é apagado. As colunas antigas (`valor_hora_mao_obra`,
-- `m2_por_hora_dupla`) ficam no banco, sem uso pelo código novo.
--
-- ORDEM: rodar ANTES de publicar o código deste bloco. É seguro rodar com a
-- versão atual do site no ar, com uma ressalva: entre rodar este arquivo e a
-- publicação do código novo, o prazo de execução de um orçamento NOVO criado
-- nesse intervalo é estimado com dia de 7 h em vez do que estava configurado
-- (o valor do orçamento não muda).
--
-- Idempotente — pode rodar mais de uma vez.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Colunas novas
-- ----------------------------------------------------------------------------
alter table config_empresa add column if not exists valor_diaria_funileiro numeric(10, 2) not null default 0;
alter table config_empresa add column if not exists valor_diaria_isolador numeric(10, 2) not null default 0;
alter table config_empresa add column if not exists valor_diaria_ajudante numeric(10, 2) not null default 0;

alter table config_empresa add column if not exists m2_dia_funileiro numeric(8, 2) not null default 0;
alter table config_empresa add column if not exists m2_dia_isolador numeric(8, 2) not null default 0;
alter table config_empresa add column if not exists m2_dia_ajudante numeric(8, 2) not null default 0;

alter table orcamentos add column if not exists mao_obra_equipe jsonb;

-- ----------------------------------------------------------------------------
-- 2. Orçamentos já existentes: guardam as horas úteis por dia que valiam
--    quando foram criados, para o prazo de execução das propostas antigas não
--    mudar quando o padrão passar a 7 h (passo 3). Só os que não tinham um
--    valor próprio e são do modelo antigo (sem `mao_obra_equipe`).
-- ----------------------------------------------------------------------------
update orcamentos
   set horas_uteis_dia = (select horas_uteis_dia from config_empresa order by id limit 1)
 where horas_uteis_dia is null
   and mao_obra_equipe is null;

-- ----------------------------------------------------------------------------
-- 3. Valores iniciais das funções + dia de 7 h. Só na primeira vez: se algum
--    dos seis valores já foi preenchido, nada aqui é alterado.
-- ----------------------------------------------------------------------------
update config_empresa
   set valor_diaria_funileiro = round((valor_hora_mao_obra / 2 * 7)::numeric, 2),
       valor_diaria_isolador  = round((valor_hora_mao_obra / 2 * 7)::numeric, 2),
       m2_dia_funileiro       = round((m2_por_hora_dupla / 2 * 7)::numeric, 2),
       m2_dia_isolador        = round((m2_por_hora_dupla / 2 * 7)::numeric, 2),
       horas_uteis_dia        = 7
 where valor_diaria_funileiro = 0
   and valor_diaria_isolador = 0
   and valor_diaria_ajudante = 0
   and m2_dia_funileiro = 0
   and m2_dia_isolador = 0
   and m2_dia_ajudante = 0;

-- ============================================================================
-- VERIFICAÇÃO
--
-- 1) Configuração (1 linha; horas_uteis_dia = 7, funileiro e isolador
--    preenchidos, ajudante zerado até você cadastrar):
--   select horas_uteis_dia,
--          valor_diaria_funileiro, valor_diaria_isolador, valor_diaria_ajudante,
--          m2_dia_funileiro, m2_dia_isolador, m2_dia_ajudante
--     from config_empresa;
--
-- 2) Orçamentos antigos com as horas úteis preservadas (nenhum nulo):
--   select count(*) from orcamentos where horas_uteis_dia is null and mao_obra_equipe is null;
-- ============================================================================
