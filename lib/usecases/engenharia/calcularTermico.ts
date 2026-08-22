// Use case: cálculo térmico de um trecho (item) de orçamento — aba "quente"
// (perda térmica + economia/CO2 opcional) ou "frio" (espessura mínima contra
// condensação). Extraído de `app/api/calcular-termico/route.ts` para poder ser
// chamado tanto pela API route quanto por testes/outros use cases sem precisar
// de um request HTTP.

import {
  calcularEconomiaECO2,
  calcularEspessuraMinimaCondensacao,
  calcularPerdaSemIsolante,
  calcularTemperaturasInterfaces,
  encontrarTemperaturaFaceFria,
} from "../../calculadora-termica";
import { ConfigurationError, ValidationError } from "../../errors";
import type {
  CalcularTermicoInput,
  CalcularTermicoResultadoFrio,
  CalcularTermicoResultadoQuente,
} from "../../types";

export function calcularTermico(
  input: CalcularTermicoInput
): CalcularTermicoResultadoQuente | CalcularTermicoResultadoFrio {
  const {
    tipo_trabalho,
    material_k_func,
    t_min,
    t_max,
    emissividade,
    geometria,
    diametro_mm,
    espessuras_mm,
    temperatura_quente,
    temperatura_ambiente,
    velocidade_vento_ms = 0,
  } = input;

  if (!espessuras_mm?.length) {
    throw new ValidationError("Informe ao menos uma camada de espessura.");
  }

  if (temperatura_quente <= temperatura_ambiente && tipo_trabalho !== "frio") {
    throw new ValidationError("A temperatura da face quente/interna deve ser maior que a ambiente.");
  }

  if (temperatura_quente < t_min || temperatura_quente > t_max) {
    throw new ValidationError(
      `Material inadequado para ${temperatura_quente}°C (limites: ${t_min}°C a ${t_max}°C).`
    );
  }

  const pipeDiameterM = geometria === "tubulacao" ? (diametro_mm ?? 0) / 1000 : undefined;
  const lTotalM = espessuras_mm.reduce((a, b) => a + b, 0) / 1000;

  if (tipo_trabalho === "quente") {
    const { temperaturaFaceFria, qTransferencia, convergiu } = encontrarTemperaturaFaceFria(
      temperatura_quente,
      temperatura_ambiente,
      lTotalM,
      material_k_func,
      geometria,
      emissividade,
      pipeDiameterM,
      velocidade_vento_ms
    );

    if (!convergiu || temperaturaFaceFria === null || qTransferencia === null) {
      throw new ConfigurationError("O cálculo não convergiu. Verifique os dados de entrada.");
    }

    const perdaComIsolanteKwM2 = qTransferencia / 1000;
    const perdaSemIsolanteKwM2 = calcularPerdaSemIsolante(
      temperatura_quente,
      temperatura_ambiente,
      geometria,
      emissividade,
      pipeDiameterM,
      velocidade_vento_ms
    );

    const temperaturasInterfaces = calcularTemperaturasInterfaces(
      temperatura_quente,
      temperaturaFaceFria,
      espessuras_mm,
      material_k_func,
      geometria,
      qTransferencia,
      diametro_mm ?? undefined
    );

    const resultado: CalcularTermicoResultadoQuente = {
      temperatura_face_fria: temperaturaFaceFria,
      temperaturas_interfaces: temperaturasInterfaces,
      perda_com_isolante_kw_m2: perdaComIsolanteKwM2,
      perda_sem_isolante_kw_m2: perdaSemIsolanteKwM2,
      convergiu: true,
    };

    if (input.calcular_financeiro && input.combustivel && input.custo_combustivel && input.area_m2) {
      const financeiro = calcularEconomiaECO2(
        perdaComIsolanteKwM2,
        perdaSemIsolanteKwM2,
        input.combustivel,
        input.custo_combustivel,
        input.area_m2,
        input.horas_operacao_dia ?? 8,
        input.dias_operacao_semana ?? 5
      );
      resultado.financeiro = {
        economia_mensal: financeiro.economiaMensal,
        economia_anual: financeiro.economiaAnual,
        reducao_percentual: financeiro.reducaoPercentual,
        co2_ton_ano: financeiro.co2TonAno,
      };
    }

    return resultado;
  }

  // tipo_trabalho === "frio": espessura mínima para evitar condensação
  if (input.umidade_relativa === undefined) {
    throw new ValidationError("Informe a umidade relativa do ar.");
  }

  if (temperatura_ambiente <= temperatura_quente) {
    throw new ValidationError("A temperatura ambiente deve ser maior que a temperatura interna.");
  }

  const { temperaturaOrvalho, espessuraMinimaMm, convergiu } = calcularEspessuraMinimaCondensacao(
    temperatura_quente,
    temperatura_ambiente,
    input.umidade_relativa,
    material_k_func,
    geometria,
    pipeDiameterM,
    velocidade_vento_ms
  );

  if (!convergiu || espessuraMinimaMm === null) {
    throw new ConfigurationError("Não foi possível encontrar uma espessura que evite condensação até 500 mm.");
  }

  const resultado: CalcularTermicoResultadoFrio = {
    temperatura_orvalho: temperaturaOrvalho,
    espessura_minima_mm: espessuraMinimaMm,
    convergiu: true,
  };

  return resultado;
}
