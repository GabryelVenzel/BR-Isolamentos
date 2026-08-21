// Quantificação de materiais — "Método Expert" já usado pela empresa,
// confirmado em ISOLAMENTO-FIXO.xlsx (aba ISOLA) e no prompt original:
//   Manta       = envolvimento (espessura × área × densidade) + 20%
//   Chapa       = envolvimento (espessura × área × densidade) + 30%
//   Rebites     = 20 por m²
//   Parafusos   = 20 por m²
//   Arame       = 500 g por m²
//   Vedação P.U.= 1 unidade a cada 1,5 m de perímetro
//   Vedacit     = latas de 360 g, conforme consumo estimado por junta

import type { QuantificarInput, QuantificarResultado } from "./types";

const FATOR_MANTA = 1.2;
const FATOR_CHAPA = 1.3;
const REBITES_POR_M2 = 20;
const PARAFUSOS_POR_M2 = 20;
const ARAME_KG_POR_M2 = 0.5; // 500 g/m²
const METROS_POR_VEDACAO_PU = 1.5;
const GRAMAS_POR_LATA_VEDACIT = 360;

/** Soma a quantificação de vários itens/trechos de um mesmo orçamento (misto), para
 * calcular o custo de materiais do orçamento inteiro num único passo. */
export function somarQuantificacoes(itens: QuantificarResultado[]): QuantificarResultado {
  return itens.reduce(
    (acc, item) => ({
      manta_kg: Number((acc.manta_kg + item.manta_kg).toFixed(2)),
      chapa_kg: Number((acc.chapa_kg + item.chapa_kg).toFixed(2)),
      rebites: acc.rebites + item.rebites,
      parafusos: acc.parafusos + item.parafusos,
      arame_kg: Number((acc.arame_kg + item.arame_kg).toFixed(2)),
      vedacao_pu: acc.vedacao_pu + item.vedacao_pu,
      vedacit_un: acc.vedacit_un + item.vedacit_un,
    }),
    { manta_kg: 0, chapa_kg: 0, rebites: 0, parafusos: 0, arame_kg: 0, vedacao_pu: 0, vedacit_un: 0 }
  );
}

/** Perímetro externo (m) do conjunto tubo + isolante, para geometria "tubulacao". */
export function calcularPerimetroTubulacao(diametroTuboMm: number, espessuraMm: number): number {
  const diametroExternoM = diametroTuboMm / 1000 + (2 * espessuraMm) / 1000;
  return Math.PI * diametroExternoM;
}

export function quantificarMateriais(input: QuantificarInput): QuantificarResultado {
  const {
    espessura_mm,
    area_m2,
    perimetro_m,
    densidade_manta_kg_m3,
    densidade_chapa_kg_m3,
    vedacit_gramas_por_junta,
  } = input;

  const espessuraM = espessura_mm / 1000;

  const mantaKg = espessuraM * area_m2 * densidade_manta_kg_m3 * FATOR_MANTA;
  const chapaKg = espessuraM * area_m2 * densidade_chapa_kg_m3 * FATOR_CHAPA;
  const rebites = Math.ceil(area_m2 * REBITES_POR_M2);
  const parafusos = Math.ceil(area_m2 * PARAFUSOS_POR_M2);
  const arameKg = area_m2 * ARAME_KG_POR_M2;
  const vedacaoPu = Math.ceil(perimetro_m / METROS_POR_VEDACAO_PU);

  // Assunção documentada (sem referência exata na planilha original):
  // cada junta de vedação P.U. consome `vedacit_gramas_por_junta` gramas de
  // Vedacit; o total é arredondado para cima em latas de 360 g.
  const vedacitUn = Math.ceil((vedacaoPu * vedacit_gramas_por_junta) / GRAMAS_POR_LATA_VEDACIT);

  return {
    manta_kg: Number(mantaKg.toFixed(2)),
    chapa_kg: Number(chapaKg.toFixed(2)),
    rebites,
    parafusos,
    arame_kg: Number(arameKg.toFixed(2)),
    vedacao_pu: vedacaoPu,
    vedacit_un: vedacitUn,
  };
}
