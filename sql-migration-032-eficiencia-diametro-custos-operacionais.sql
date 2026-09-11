-- ============================================================================
-- BR Isolamentos — Migração 032: faixas escalonáveis de eficiência por
-- diâmetro de tubulação, horas úteis por orçamento, e novos custos
-- operacionais (aluguel de carro / alimentação por diária).
--
-- 100% aditiva (nenhuma coluna existente é removida ou renomeada) e
-- idempotente.
--
-- DECISÕES DE PROJETO (pedido explícito do usuário):
--
-- 1) Eficiência de mão de obra por diâmetro de tubulação deixa de ter um
--    único limiar (< 4" = "tubulação pequena") e passa a ter 3 faixas
--    escalonáveis: >= 6" eficiência 1 (sem penalidade, sem coluna própria),
--    3"–6" um fator ajustável NOVO (`eficiencia_tubulacao_media`), < 3" outro
--    fator ajustável (`eficiencia_tubulacao_pequena`, coluna já existente —
--    só o limiar mudou de 4" pra 3"). Ver
--    lib/usecases/orcamento/escopo.ts#faixaDiametroTubulacao.
--
--    `eficiencia_tubulacao_media` é criada com o MESMO valor já configurado
--    em `eficiencia_tubulacao_pequena` (backfill abaixo) — é uma faixa nova
--    que não existia antes, então herdar o fator mais próximo já configurado
--    evita que o comportamento mude "de graça" sem o usuário revisar/ajustar
--    esse número em Configurar Preços.
--
-- 2) "Horas úteis por dia" era só um valor global (ConfigEmpresa) usado pra
--    estimar o prazo de execução. Passa a poder ser ajustado POR ORÇAMENTO
--    (`orcamentos.horas_uteis_dia`, opcional) — porque nem toda hora paga é
--    produtiva (deslocamento/liberação de acesso no local variam de obra pra
--    obra), então o número de dias de execução pode precisar ser maior do
--    que a conta com o padrão global sugere. `null` = usa o padrão da
--    config, sem mudar comportamento de orçamentos já existentes. Só afeta o
--    PRAZO DE EXECUÇÃO exibido na Proposta, nunca o valor financeiro.
--
-- 3) Novos custos operacionais cobrados por diária: "Aluguel de carro" e
--    "Alimentação" (esta última substitui a linha "Alimentação: Incluso"
--    sem valor rastreado que existia antes na Proposta). Frete
--    (`valor_frete_por_tonelada`, já existente) deixou de ser editável na
--    tela Configurar Preços (pedido explícito) — a Tela 4 do orçamento
--    continua com o campo "Frete (toneladas)" e usando esse valor no
--    cálculo, só não dá mais pra ajustar a taxa por essa tela.
-- ============================================================================

alter table config_empresa add column if not exists eficiencia_tubulacao_media numeric(4, 2) not null default 1;
update config_empresa
set eficiencia_tubulacao_media = eficiencia_tubulacao_pequena
where eficiencia_tubulacao_media = 1;

alter table config_empresa add column if not exists valor_diaria_aluguel_carro numeric(10, 2) not null default 0;
alter table config_empresa add column if not exists valor_diaria_alimentacao numeric(10, 2) not null default 0;

alter table orcamentos add column if not exists valor_aluguel_carro numeric(10, 2) not null default 0;
alter table orcamentos add column if not exists valor_alimentacao numeric(10, 2) not null default 0;
-- Nullable de propósito — `null` = usa o padrão de config_empresa.horas_uteis_dia.
alter table orcamentos add column if not exists horas_uteis_dia numeric(5, 2);

-- ============================================================================
-- Como aplicar: cole este arquivo inteiro no SQL Editor do Supabase e rode.
--
-- IMPORTANTE: depois de rodar, confira/ajuste "Eficiência tubulação 3"–6""
-- em Configurar Preços — o valor inicial é só uma cópia da faixa "< 3"" pra
-- não zerar a penalidade dessa faixa nova; pode não ser o número ideal pro
-- seu caso.
--
-- Verificação rápida:
--   select eficiencia_tubulacao_pequena, eficiencia_tubulacao_media from config_empresa;
--   select valor_diaria_aluguel_carro, valor_diaria_alimentacao from config_empresa;
--   select valor_aluguel_carro, valor_alimentacao, horas_uteis_dia from orcamentos limit 5;
-- ============================================================================
