// Cálculo da alíquota efetiva do Simples Nacional (LC 123/2006, tabelas vigentes desde
// a LC 155/2016 — Anexos III e IV). Fórmula oficial:
//   aliquotaEfetiva = (RBT12 * aliquotaNominal - valorADeduzir) / RBT12
//
// Anexo III: serviços em geral (inclui CPP/INSS patronal dentro do DAS).
// Anexo IV: construção civil, serviços de engenharia e instalação em geral (CPP é
// recolhida à parte, fora do DAS). BR Isolamentos presta serviço de instalação —
// o sistema usa Anexo IV como padrão, mas isso deve ser confirmado com o contador,
// pois a enquadramento correto depende de como o contrato é formalizado.

import type { AnexoSimplesNacional } from "./types";

interface FaixaSimplesNacional {
  ate: number;
  aliquotaNominal: number; // fração (ex.: 0.06 = 6%)
  valorADeduzir: number;
}

const TABELA_ANEXO_III: FaixaSimplesNacional[] = [
  { ate: 180_000, aliquotaNominal: 0.06, valorADeduzir: 0 },
  { ate: 360_000, aliquotaNominal: 0.112, valorADeduzir: 9_360 },
  { ate: 720_000, aliquotaNominal: 0.135, valorADeduzir: 17_640 },
  { ate: 1_800_000, aliquotaNominal: 0.16, valorADeduzir: 35_640 },
  { ate: 3_600_000, aliquotaNominal: 0.21, valorADeduzir: 125_640 },
  { ate: 4_800_000, aliquotaNominal: 0.33, valorADeduzir: 648_000 },
];

const TABELA_ANEXO_IV: FaixaSimplesNacional[] = [
  { ate: 180_000, aliquotaNominal: 0.045, valorADeduzir: 0 },
  { ate: 360_000, aliquotaNominal: 0.09, valorADeduzir: 8_100 },
  { ate: 720_000, aliquotaNominal: 0.102, valorADeduzir: 12_420 },
  { ate: 1_800_000, aliquotaNominal: 0.14, valorADeduzir: 39_780 },
  { ate: 3_600_000, aliquotaNominal: 0.22, valorADeduzir: 183_780 },
  { ate: 4_800_000, aliquotaNominal: 0.33, valorADeduzir: 828_000 },
];

export interface AliquotaSimplesNacionalResultado {
  aliquotaNominalPercentual: number;
  valorADeduzir: number;
  aliquotaEfetivaPercentual: number;
}

/**
 * Retorna a alíquota efetiva do Simples Nacional (%) para o RBT12 e anexo informados.
 * Retorna `null` se o RBT12 for inválido (<= 0) ou ultrapassar o limite do Simples
 * Nacional (R$ 4.800.000,00) — nesses casos o chamador deve bloquear o cálculo do
 * orçamento com uma mensagem clara em vez de usar um percentual arbitrário.
 */
export function calcularAliquotaSimplesNacional(
  rbt12: number,
  anexo: AnexoSimplesNacional
): AliquotaSimplesNacionalResultado | null {
  if (!rbt12 || rbt12 <= 0 || rbt12 > 4_800_000) return null;

  const tabela = anexo === "III" ? TABELA_ANEXO_III : TABELA_ANEXO_IV;
  const faixa = tabela.find((f) => rbt12 <= f.ate);
  if (!faixa) return null;

  const aliquotaEfetiva = (rbt12 * faixa.aliquotaNominal - faixa.valorADeduzir) / rbt12;

  return {
    aliquotaNominalPercentual: faixa.aliquotaNominal * 100,
    valorADeduzir: faixa.valorADeduzir,
    aliquotaEfetivaPercentual: Math.max(0, aliquotaEfetiva * 100),
  };
}

/** Impostos federais/municipais padrão para quem opera fora do Simples Nacional
 * (Lucro Presumido), para serviços — usados só para pré-popular `impostos_config`
 * quando o regime é trocado para "lucro_presumido". Percentuais editáveis depois. */
export const IMPOSTOS_LUCRO_PRESUMIDO_PADRAO = [
  { nome: "PIS", percentual: 0.65 },
  { nome: "COFINS", percentual: 3.0 },
  { nome: "ISS", percentual: 5.0 },
  { nome: "IRPJ (presumido)", percentual: 4.8 },
  { nome: "CSLL (presumido)", percentual: 2.88 },
];
