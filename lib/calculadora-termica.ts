// Motor de cálculo térmico — porte fiel de
// `2-DocumentaçãoTecnica/CALCULADORA-TERMICA.py` (calculadora Streamlit já
// usada pela empresa) para TypeScript, conforme ASTM C680 / ISO 12241 /
// ABNT NBR 16281: condução na camada de isolante em equilíbrio com convecção
// (natural ou forçada) + radiação na face externa, resolvido por busca
// iterativa da temperatura de face fria.
//
// Qualquer alteração numérica aqui deve ser validada comparando o resultado
// com o app Python original antes de ir para produção.

import type { CombustivelTipo, Geometria } from "./types";

const SIGMA = 5.67e-8; // constante de Stefan-Boltzmann [W/m²K⁴]

/**
 * Avalia a condutividade térmica k(T) [W/m.K] a partir da fórmula cadastrada
 * para o material (ex.: "0.031 + 0.00019*T"), onde T é a temperatura média
 * [°C] entre face quente e face fria da camada.
 *
 * A fórmula é dado de entrada de administrador (cadastro de materiais), não
 * de usuário final — mesmo nível de confiança que o `eval` usado no
 * calculador Python original. Ainda assim, o escopo do avaliador é
 * restrito a `T` e `Math`, sem acesso a globals/closures.
 */
export function calcularK(kFuncStr: string, tMedia: number): number | null {
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function("T", "Math", `"use strict"; return (${kFuncStr});`);
    const resultado = fn(tMedia, Math);
    return typeof resultado === "number" && Number.isFinite(resultado)
      ? resultado
      : null;
  } catch {
    return null;
  }
}

/**
 * Coeficiente de convecção h [W/m²K] na face externa, por convecção natural
 * (Rayleigh) quando `windSpeedMs < 1` ou forçada (Reynolds) quando >= 1.
 */
export function calcularHConv(
  tf: number,
  to: number,
  geometria: Geometria,
  outerDiameterM: number | null | undefined,
  windSpeedMs = 0
): number {
  const tfK = tf + 273.15;
  const toK = to + 273.15;
  const tFilmK = (tfK + toK) / 2;

  const g = 9.81;
  const beta = 1 / tFilmK;
  const nu = 1.589e-5 * (tFilmK / 293.15) ** 0.7;
  const alpha = 2.25e-5 * (tFilmK / 293.15) ** 0.8;
  const kAr = 0.0263;
  const pr = nu / alpha;
  const deltaT = Math.abs(tf - to);

  if (deltaT === 0) return 0;

  let lC: number;
  let nu_: number; // número de Nusselt

  if (windSpeedMs >= 1.0) {
    lC = geometria === "plana" ? 1.0 : outerDiameterM ?? 1.0;
    if (!lC) lC = 1.0;
    const re = (windSpeedMs * lC) / nu;
    if (re < 5e5) {
      nu_ = 0.664 * re ** 0.5 * pr ** (1 / 3);
    } else {
      nu_ = (0.037 * re ** 0.8 - 871) * pr ** (1 / 3);
    }
  } else if (geometria === "plana") {
    lC = 0.1;
    const ra = (g * beta * deltaT * lC ** 3) / (nu * alpha);
    nu_ = 0.27 * ra ** (1 / 4);
  } else {
    lC = outerDiameterM ?? 0;
    const ra = (g * beta * deltaT * lC ** 3) / (nu * alpha);
    const term1 = 0.6;
    const term2 = (0.387 * ra ** (1 / 6)) / (1 + (0.559 / pr) ** (9 / 16)) ** (8 / 27);
    nu_ = (term1 + term2) ** 2;
  }

  return (nu_ * kAr) / lC;
}

export interface ResultadoFaceFria {
  temperaturaFaceFria: number | null;
  qTransferencia: number | null;
  convergiu: boolean;
}

/**
 * Busca iterativa (bisseção com passo decrescente) da temperatura de face
 * fria que equilibra condução na camada de isolante com convecção + radiação
 * na face externa.
 *
 * @param lTotalM espessura total do isolante, em metros (soma das camadas)
 * @param pipeDiameterM diâmetro externo do tubo (sem isolante), em metros — obrigatório para geometria "tubulacao"
 */
export function encontrarTemperaturaFaceFria(
  tQuente: number,
  tAmbiente: number,
  lTotalM: number,
  kFuncStr: string,
  geometria: Geometria,
  emissividade: number,
  pipeDiameterM?: number,
  windSpeedMs = 0
): ResultadoFaceFria {
  let tf = tAmbiente + 10.0;
  const maxIter = 1000;
  let step = 50.0;
  const minStep = 0.001;
  const tolerancia = 0.5;
  let erroAnterior: number | null = null;

  for (let i = 0; i < maxIter; i++) {
    const tMedia = (tQuente + tf) / 2;
    const k = calcularK(kFuncStr, tMedia);
    if (k === null || k <= 0) {
      return { temperaturaFaceFria: null, qTransferencia: null, convergiu: false };
    }

    let qConducao: number;
    let outerSurfaceDiameter: number;

    if (geometria === "plana") {
      qConducao = (k * (tQuente - tf)) / lTotalM;
      outerSurfaceDiameter = lTotalM;
    } else {
      if (!pipeDiameterM) {
        return { temperaturaFaceFria: null, qTransferencia: null, convergiu: false };
      }
      const rInner = pipeDiameterM / 2;
      const rOuter = rInner + lTotalM;
      if (rInner <= 0 || rOuter <= rInner) {
        return { temperaturaFaceFria: null, qTransferencia: null, convergiu: false };
      }
      qConducao = (k * (tQuente - tf)) / (rOuter * Math.log(rOuter / rInner));
      outerSurfaceDiameter = rOuter * 2;
    }

    const tfK = tf + 273.15;
    const toK = tAmbiente + 273.15;
    const hConv = calcularHConv(tf, tAmbiente, geometria, outerSurfaceDiameter, windSpeedMs);
    const qRad = emissividade * SIGMA * (tfK ** 4 - toK ** 4);
    const qConv = hConv * (tf - tAmbiente);
    const qTransferencia = qConv + qRad;

    const erro = qConducao - qTransferencia;
    if (Math.abs(erro) < tolerancia) {
      return { temperaturaFaceFria: tf, qTransferencia, convergiu: true };
    }

    if (erroAnterior !== null && erro * erroAnterior < 0) {
      step = Math.max(minStep, step * 0.5);
    }
    tf += erro > 0 ? step : -step;
    erroAnterior = erro;
  }

  return { temperaturaFaceFria: tf, qTransferencia: null, convergiu: false };
}

/**
 * Temperatura na interface entre cada camada, para isolamento com múltiplas
 * camadas. Simplificação herdada do cálculo original: todas as camadas usam
 * o mesmo k(T) do material selecionado (calculado na temperatura média
 * global) — se no futuro o formulário permitir materiais diferentes por
 * camada, esta função precisa ser revista para usar o k de cada material.
 */
export function calcularTemperaturasInterfaces(
  tQuente: number,
  tFria: number,
  espessurasMm: number[],
  kFuncStr: string,
  geometria: Geometria,
  qComIsolanteWM2: number,
  diametroTuboMm?: number
): number[] {
  if (espessurasMm.length <= 1) return [];

  const kMedio = calcularK(kFuncStr, (tQuente + tFria) / 2);
  if (kMedio === null || kMedio <= 0) return [];

  const lTotalM = espessurasMm.reduce((a, b) => a + b, 0) / 1000;
  const interfaces: number[] = [];
  let tAtual = tQuente;

  for (let i = 0; i < espessurasMm.length - 1; i++) {
    let deltaTCamada: number;

    if (geometria === "plana") {
      const resistenciaCamada = espessurasMm[i] / 1000 / kMedio;
      deltaTCamada = qComIsolanteWM2 * resistenciaCamada;
    } else {
      const raioTuboM = (diametroTuboMm ?? 0) / 2000;
      const somaAnteriores = espessurasMm.slice(0, i).reduce((a, b) => a + b, 0) / 1000;
      const rCamadaI = raioTuboM + somaAnteriores;
      const rCamadaO = rCamadaI + espessurasMm[i] / 1000;
      const qLinha = qComIsolanteWM2 * (2 * Math.PI * (raioTuboM + lTotalM));
      const resistenciaTermicaLinha = Math.log(rCamadaO / rCamadaI) / (2 * Math.PI * kMedio);
      deltaTCamada = qLinha * resistenciaTermicaLinha;
    }

    const tInterface = tAtual - deltaTCamada;
    interfaces.push(tInterface);
    tAtual = tInterface;
  }

  return interfaces;
}

// --- Financeiro / ambiental (aba "quente") ---

interface CombustivelInfo {
  /** custo de referência (R$ por unidade do combustível) */
  v: number;
  /** poder calorífico (kWh por unidade do combustível) */
  pc: number;
  /** eficiência do equipamento */
  ef: number;
  /** fator de emissão de CO2 (kg CO2 por unidade do combustível) */
  fatorEmissao: number;
  unidade: string;
  label: string;
}

export const COMBUSTIVEIS: Record<CombustivelTipo, CombustivelInfo> = {
  oleo_bpf: { v: 3.5, pc: 11.34, ef: 0.8, fatorEmissao: 3.15, unidade: "kg", label: "Óleo BPF" },
  gas_natural: { v: 3.6, pc: 9.65, ef: 0.75, fatorEmissao: 2.0, unidade: "m³", label: "Gás Natural" },
  lenha_eucalipto: {
    v: 200.0,
    pc: 3500.0,
    ef: 0.7,
    fatorEmissao: 1260,
    unidade: "ton",
    label: "Lenha Eucalipto (30% umidade)",
  },
  eletricidade: { v: 0.75, pc: 1.0, ef: 1.0, fatorEmissao: 0.0358, unidade: "kWh", label: "Eletricidade" },
};

export interface EconomiaECO2Resultado {
  economiaMensal: number;
  economiaAnual: number;
  reducaoPercentual: number;
  co2TonAno: number;
}

/**
 * Economia financeira e carbono evitado ao comparar a perda térmica com e
 * sem isolante, para uma área/regime de operação informados.
 */
export function calcularEconomiaECO2(
  perdaComIsolanteKwM2: number,
  perdaSemIsolanteKwM2: number,
  combustivel: CombustivelTipo,
  custoCombustivel: number,
  areaM2: number,
  horasOperacaoDia: number,
  diasOperacaoSemana: number
): EconomiaECO2Resultado {
  const { pc, ef, fatorEmissao } = COMBUSTIVEIS[combustivel];

  const economiaKwM2 = perdaSemIsolanteKwM2 - perdaComIsolanteKwM2;
  const custoKwh = custoCombustivel / (pc * ef);
  const economiaMensal = economiaKwM2 * custoKwh * areaM2 * horasOperacaoDia * diasOperacaoSemana * 4.33;
  const economiaAnual = economiaMensal * 12;
  const reducaoPercentual =
    perdaSemIsolanteKwM2 > 0 ? (economiaKwM2 / perdaSemIsolanteKwM2) * 100 : 0;

  const energiaEfetivaAnualKwh = economiaKwM2 * areaM2 * horasOperacaoDia * diasOperacaoSemana * 4.33 * 12;
  const energiaBrutaAnualKwh = energiaEfetivaAnualKwh / ef;
  const quantidadeCombPoupado = energiaBrutaAnualKwh / pc;
  const co2EvitadoAnualKg = quantidadeCombPoupado * fatorEmissao;

  return {
    economiaMensal,
    economiaAnual,
    reducaoPercentual,
    co2TonAno: co2EvitadoAnualKg / 1000,
  };
}

// --- Cálculo "frio" (condensação) ---

export interface CondensacaoResultado {
  temperaturaOrvalho: number;
  espessuraMinimaMm: number | null;
  convergiu: boolean;
}

/** Temperatura de orvalho pela fórmula de Magnus. */
export function calcularTemperaturaOrvalho(tAmbiente: number, umidadeRelativa: number): number {
  const aMag = 17.27;
  const bMag = 237.7;
  const alfa = (aMag * tAmbiente) / (bMag + tAmbiente) + Math.log(umidadeRelativa / 100.0);
  return (bMag * alfa) / (aMag - alfa);
}

/**
 * Busca a menor espessura de isolante (1 a 500 mm, passo de 1 mm) que
 * mantém a temperatura de face fria acima do ponto de orvalho, evitando
 * condensação.
 */
export function calcularEspessuraMinimaCondensacao(
  tInterna: number,
  tAmbiente: number,
  umidadeRelativa: number,
  kFuncStr: string,
  geometria: Geometria,
  pipeDiameterM: number | undefined,
  windSpeedMs = 0
): CondensacaoResultado {
  const temperaturaOrvalho = calcularTemperaturaOrvalho(tAmbiente, umidadeRelativa);

  for (let mm = 1; mm <= 500; mm++) {
    const lTesteM = mm / 1000;
    const { temperaturaFaceFria, convergiu } = encontrarTemperaturaFaceFria(
      tInterna,
      tAmbiente,
      lTesteM,
      kFuncStr,
      geometria,
      0.9,
      pipeDiameterM,
      windSpeedMs
    );
    if (convergiu && temperaturaFaceFria !== null && temperaturaFaceFria >= temperaturaOrvalho) {
      return { temperaturaOrvalho, espessuraMinimaMm: mm, convergiu: true };
    }
  }

  return { temperaturaOrvalho, espessuraMinimaMm: null, convergiu: false };
}

/** Perda de calor [kW/m²] pela superfície nua, sem isolante (referência para comparação/economia). */
export function calcularPerdaSemIsolante(
  tQuente: number,
  tAmbiente: number,
  geometria: Geometria,
  emissividade: number,
  pipeDiameterM?: number,
  windSpeedMs = 0
): number {
  const outerDiameter = geometria === "tubulacao" ? pipeDiameterM : undefined;
  const hSem = calcularHConv(tQuente, tAmbiente, geometria, outerDiameter, windSpeedMs);
  const qRadSem = emissividade * SIGMA * ((tQuente + 273.15) ** 4 - (tAmbiente + 273.15) ** 4);
  const qConvSem = hSem * (tQuente - tAmbiente);
  return (qRadSem + qConvSem) / 1000;
}
