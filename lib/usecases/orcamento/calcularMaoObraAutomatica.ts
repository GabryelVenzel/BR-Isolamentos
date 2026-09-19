// Mão de obra automática por trecho (migração 019) — substitui o campo
// manual "Mão de obra deste trecho (horas)" que existia no wizard. Puro, sem
// I/O. Fórmula do pedido ("Security States Grave"), com o fator de diâmetro
// agora escalonado em 3 faixas (migração 032 — pedido explícito, ver
// lib/usecases/orcamento/escopo.ts#faixaDiametroTubulacao):
//
//   fator_diametro    = diâmetro<3" ? eficiencia_tubulacao_pequena
//                       : diâmetro<6" ? eficiencia_tubulacao_media
//                       : 1                                    [>= 6" ou sem diâmetro/"plano"]
//   eficiência_global = fator_diametro × (curvas ? fator : 1) ×
//                        (altura ? fator : 1) × fator_br  [sempre aplicado]
//   horas_base        = m² ÷ m²_por_hora_dupla
//   horas_ajustadas   = horas_base ÷ eficiência_global
//   dias_necessarios  = horas_ajustadas ÷ horas_úteis_dia
//
// A fórmula acima vale POR ITEM do Escopo (ver `calcularMaoObraPorItens`, é o
// que o orçamento usa) — cada reta/curva/plano tem a própria eficiência, e as
// horas dos itens são somadas. Só a altura vale pro trecho inteiro.
//
// Os fatores SEMPRE se multiplicam entre si (nunca somam) — quanto mais
// condições difíceis (tubo fino + curva + altura), menor a eficiência e mais
// horas o mesmo m² exige. Referência de base: 1 dupla (2 pessoas) = 2m²/hora
// a 100% de eficiência — este cálculo já assume no mínimo 1 dupla, nunca
// menos.

import type { ConfigEmpresa } from "../../types";
import type { FaixaDiametroTubulacao } from "./escopo";

export type ParametrosMaoObra = Pick<
  ConfigEmpresa,
  | "m2_por_hora_dupla"
  | "eficiencia_tubulacao_pequena"
  | "eficiencia_tubulacao_media"
  | "eficiencia_curva"
  | "eficiencia_altura"
  | "eficiencia_fator_br"
  | "horas_uteis_dia"
>;

export interface FatoresMaoObra {
  /** `null` = sem item de tubulação/curva no trecho (só "plano") — mesmo
   * efeito de "grande" (>= 6"), eficiência 1, sem penalidade. */
  faixaDiametro: FaixaDiametroTubulacao | null;
  temCurvas: boolean;
  trabalhoAltura: boolean;
}

export interface MaoObraAutomatica {
  eficienciaGlobal: number;
  horasBase: number;
  horasAjustadas: number;
  diasNecessarios: number;
}

function eficienciaDe(fatores: FatoresMaoObra, parametros: ParametrosMaoObra): number {
  let eficiencia = 1;
  if (fatores.faixaDiametro === "pequena") eficiencia *= parametros.eficiencia_tubulacao_pequena;
  else if (fatores.faixaDiametro === "media") eficiencia *= parametros.eficiencia_tubulacao_media;
  // "grande" (>= 6") ou `null` (sem tubulação/curva, só "plano") — eficiência
  // 1, sem multiplicação.
  if (fatores.temCurvas) eficiencia *= parametros.eficiencia_curva;
  if (fatores.trabalhoAltura) eficiencia *= parametros.eficiencia_altura;
  eficiencia *= parametros.eficiencia_fator_br;
  return eficiencia;
}

const round4 = (n: number) => Number(n.toFixed(4));
const round2 = (n: number) => Number(n.toFixed(2));

function horasDe(metragemM2: number, eficiencia: number, parametros: ParametrosMaoObra) {
  const horasBase = parametros.m2_por_hora_dupla > 0 ? metragemM2 / parametros.m2_por_hora_dupla : 0;
  const horasAjustadas = eficiencia > 0 ? horasBase / eficiencia : horasBase;
  return { horasBase, horasAjustadas };
}

/** Uma única eficiência pra metragem inteira — usada pelo cálculo por item
 * abaixo como bloco de construção (uma chamada por item do Escopo). */
export function calcularMaoObraAutomatica(
  metragemM2: number,
  fatores: FatoresMaoObra,
  parametros: ParametrosMaoObra
): MaoObraAutomatica {
  const eficiencia = eficienciaDe(fatores, parametros);
  const { horasBase, horasAjustadas } = horasDe(metragemM2, eficiencia, parametros);
  const diasNecessarios = parametros.horas_uteis_dia > 0 ? horasAjustadas / parametros.horas_uteis_dia : 0;

  return {
    eficienciaGlobal: round4(eficiencia),
    horasBase: round2(horasBase),
    horasAjustadas: round2(horasAjustadas),
    diasNecessarios: round2(diasNecessarios),
  };
}

/** Um item do Escopo pra efeito de mão de obra: a metragem dele + os fatores
 * que valem SÓ pra ele (o diâmetro dele, se é curva ou não). Altura vale pro
 * trecho inteiro e entra em todos. */
export interface ItemMaoObra {
  metragemM2: number;
  faixaDiametro: FaixaDiametroTubulacao | null;
  ehCurva: boolean;
}

/** Mão de obra do trecho calculada ITEM A ITEM (bug relatado: 100 m de
 * tubulação reta com 2 curvas dava o dobro do tempo, porque o fator de curva
 * — e o menor diâmetro — era aplicado sobre a metragem INTEIRA do trecho).
 * Cada item usa a eficiência que é dele: a reta só com o fator do próprio
 * diâmetro, a curva com o fator do diâmetro × fator de curva; o plano sem
 * fator de diâmetro nem de curva. As horas de cada item são somadas.
 *
 * `eficienciaGlobal` devolvido é a eficiência MÉDIA PONDERADA (horas base ÷
 * horas ajustadas) — o número que a Tela 4 mostra como "eficiência" e que
 * é salvo no trecho; em trecho com um item só (ou todos iguais) coincide
 * exatamente com a eficiência única de antes. */
export function calcularMaoObraPorItens(
  itens: ItemMaoObra[],
  trabalhoAltura: boolean,
  parametros: ParametrosMaoObra
): MaoObraAutomatica {
  let totalBase = 0;
  let totalAjustadas = 0;

  for (const item of itens) {
    const eficiencia = eficienciaDe(
      { faixaDiametro: item.faixaDiametro, temCurvas: item.ehCurva, trabalhoAltura },
      parametros
    );
    const { horasBase, horasAjustadas } = horasDe(item.metragemM2, eficiencia, parametros);
    totalBase += horasBase;
    totalAjustadas += horasAjustadas;
  }

  // Sem nenhum item com metragem, cai na eficiência "só altura × fator BR".
  const eficienciaMedia =
    totalAjustadas > 0 ? totalBase / totalAjustadas : eficienciaDe({ faixaDiametro: null, temCurvas: false, trabalhoAltura }, parametros);
  const diasNecessarios = parametros.horas_uteis_dia > 0 ? totalAjustadas / parametros.horas_uteis_dia : 0;

  return {
    eficienciaGlobal: round4(eficienciaMedia),
    horasBase: round2(totalBase),
    horasAjustadas: round2(totalAjustadas),
    diasNecessarios: round2(diasNecessarios),
  };
}
