// Use case de economia de energia — só disponível no painel Quente (ver
// checklist do pedido: "FRIO: SEM seção de economia").
//
// Reaproveita `calcularEconomiaECO2` de lib/calculadora-termica.ts — a MESMA
// função já usada pelo wizard de orçamento (app/novo-orcamento/step-3-calculos),
// com a tabela `COMBUSTIVEIS` (poder calorífico, eficiência padrão e fator
// de emissão de CO2 por combustível) documentada e validada pelo usuário.
// Nada de fórmula nova aqui — o único trabalho deste use case é validar o
// input e, se houver valor de investimento informado, calcular o ROI (que
// calcularEconomiaECO2 não calcula, por não saber de investimento nenhum).
//
// Eficiência do equipamento NÃO é parâmetro deste use case — vem embutida
// em COMBUSTIVEIS[combustivel].ef, não é editável pelo usuário (ver
// lib/validators/engenharia.ts). Horas de operação entram como
// horas/dia + dias/semana (mesmo padrão do wizard), não "horas/ano".

import { calcularEconomiaECO2 } from "../../calculadora-termica";
import { CalcularEconomiaSchema, parseOrThrow } from "../../validators";

export interface ResultadoEconomia {
  economia_anual_kwh: number;
  economia_financeira_anual: number;
  co2_reduzido_ton_ano: number;
  roi_meses: number | null;
}

export function calcularEconomia(input: unknown): ResultadoEconomia {
  const dados = parseOrThrow(CalcularEconomiaSchema, input);

  const resultado = calcularEconomiaECO2(
    dados.perda_com_isolante_kw_m2,
    dados.perda_sem_isolante_kw_m2,
    dados.combustivel,
    dados.custo_combustivel,
    dados.area_m2,
    dados.horas_operacao_dia,
    dados.dias_operacao_semana
  );

  const roiMeses =
    dados.valor_investimento && resultado.economiaAnual > 0
      ? (dados.valor_investimento / resultado.economiaAnual) * 12
      : null;

  return {
    economia_anual_kwh: resultado.energiaEfetivaAnualKwh,
    economia_financeira_anual: resultado.economiaAnual,
    co2_reduzido_ton_ano: resultado.co2TonAno,
    roi_meses: roiMeses,
  };
}
