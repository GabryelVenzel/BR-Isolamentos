import { NextResponse } from "next/server";
import {
  calcularEconomiaECO2,
  calcularEspessuraMinimaCondensacao,
  calcularPerdaSemIsolante,
  calcularTemperaturasInterfaces,
  encontrarTemperaturaFaceFria,
} from "@/lib/calculadora-termica";
import type {
  CalcularTermicoInput,
  CalcularTermicoResultadoFrio,
  CalcularTermicoResultadoQuente,
} from "@/lib/types";

export async function POST(request: Request) {
  const input = (await request.json().catch(() => null)) as CalcularTermicoInput | null;

  if (!input) {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

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
    return NextResponse.json({ error: "Informe ao menos uma camada de espessura." }, { status: 400 });
  }

  if (temperatura_quente <= temperatura_ambiente) {
    return NextResponse.json(
      { error: "A temperatura da face quente/interna deve ser maior que a ambiente." },
      { status: 400 }
    );
  }

  if (temperatura_quente < t_min || temperatura_quente > t_max) {
    return NextResponse.json(
      {
        error: `Material inadequado para ${temperatura_quente}°C (limites: ${t_min}°C a ${t_max}°C).`,
      },
      { status: 400 }
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
      return NextResponse.json(
        { error: "O cálculo não convergiu. Verifique os dados de entrada." },
        { status: 422 }
      );
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

    return NextResponse.json(resultado);
  }

  // tipo_trabalho === "frio": espessura mínima para evitar condensação
  if (input.umidade_relativa === undefined) {
    return NextResponse.json({ error: "Informe a umidade relativa do ar." }, { status: 400 });
  }

  if (temperatura_ambiente <= temperatura_quente) {
    return NextResponse.json(
      { error: "A temperatura ambiente deve ser maior que a temperatura interna." },
      { status: 400 }
    );
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
    return NextResponse.json(
      { error: "Não foi possível encontrar uma espessura que evite condensação até 500 mm." },
      { status: 422 }
    );
  }

  const resultado: CalcularTermicoResultadoFrio = {
    temperatura_orvalho: temperaturaOrvalho,
    espessura_minima_mm: espessuraMinimaMm,
    convergiu: true,
  };

  return NextResponse.json(resultado);
}
