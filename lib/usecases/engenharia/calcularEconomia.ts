// Use case de economia de energia — só disponível no painel Quente (ver
// checklist do pedido: "FRIO: SEM seção de economia").
//
// Reaproveita a tabela `COMBUSTIVEIS` de lib/calculadora-termica.ts (poder
// calorífico, eficiência padrão e fator de emissão de CO2 por combustível) —
// a mesma tabela já usada pelo wizard de orçamento, com fonte documentada
// (2-DocumentaçãoTecnica/materials_internal.py) e "pesquisada e validada
// pelo usuário" (ver o comentário original ao lado da constante). NÃO
// reimplementamos uma tabela de conversão nova: os fatores de emissão de
// CO2 variam MUITO entre fontes/países (ex.: eletricidade no Brasil, matriz
// majoritariamente hidrelétrica, tem fator de emissão bem mais baixo que a
// média mundial) — usar um número genérico "média global" aqui daria um
// resultado errado especificamente para o caso de uso da empresa.
//
// A única adaptação real: o formulário deste módulo pede "horas de operação
// por ano" (um campo só, mais rápido de preencher numa calculadora de
// bolso) em vez de "horas/dia" + "dias/semana" do wizard completo —
// dimensionalmente equivalente (kWh/ano = perda_kW/m² × área_m² ×
// horas/ano), só reorganiza os mesmos fatores de
// lib/calculadora-termica.ts#calcularEconomiaECO2.

import { COMBUSTIVEIS } from "../../calculadora-termica";
import { CalcularEconomiaSchema, parseOrThrow } from "../../validators";

export interface ResultadoEconomia {
  economia_anual_kwh: number;
  economia_financeira_anual: number;
  co2_reduzido_ton_ano: number;
  roi_meses: number | null;
}

export function calcularEconomia(input: unknown): ResultadoEconomia {
  const dados = parseOrThrow(CalcularEconomiaSchema, input);
  const { pc, ef, fatorEmissao } = COMBUSTIVEIS[dados.combustivel];

  // Eficiência do equipamento: o formulário pré-preenche com o valor
  // validado da tabela (`ef` × 100), mas o usuário pode ajustar pra
  // refletir o equipamento real em campo — por isso o parâmetro vem do
  // input, não direto da tabela.
  const eficiencia = dados.eficiencia_percentual / 100;

  const economiaKwM2 = dados.perda_sem_isolante_kw_m2 - dados.perda_com_isolante_kw_m2;
  const energiaEfetivaAnualKwh = economiaKwM2 * dados.area_m2 * dados.horas_operacao_ano;

  const custoKwh = dados.custo_combustivel / (pc * eficiencia);
  const economiaFinanceiraAnual = economiaKwM2 * custoKwh * dados.area_m2 * dados.horas_operacao_ano;

  const energiaBrutaAnualKwh = energiaEfetivaAnualKwh / eficiencia;
  const quantidadeCombustivelPoupado = energiaBrutaAnualKwh / pc;
  const co2EvitadoAnualKg = quantidadeCombustivelPoupado * fatorEmissao;

  const roiMeses =
    dados.valor_investimento && economiaFinanceiraAnual > 0
      ? (dados.valor_investimento / economiaFinanceiraAnual) * 12
      : null;

  return {
    economia_anual_kwh: energiaEfetivaAnualKwh,
    economia_financeira_anual: economiaFinanceiraAnual,
    co2_reduzido_ton_ano: co2EvitadoAnualKg / 1000,
    roi_meses: roiMeses,
  };
}
