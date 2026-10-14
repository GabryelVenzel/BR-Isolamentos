// Trabalho de mão de obra por trecho (migração 019, revisto na 048) — puro,
// sem I/O. Calcula QUANTO trabalho um trecho dá, independente de quem vai
// executar: a metragem de cada item do Escopo dividida pela eficiência dele.
//
//   fator_diametro    = diâmetro<3" ? eficiencia_tubulacao_pequena
//                       : diâmetro<6" ? eficiencia_tubulacao_media
//                       : 1                                    [>= 6" ou sem diâmetro/"plano"]
//   eficiência_global = fator_diametro × (curvas ? fator : 1) ×
//                        (altura ? fator : 1) × (remoção ? fator : 1) ×
//                        fator_br  [sempre aplicado]
//   m²_equivalentes   = m² ÷ eficiência_global
//
// A fórmula vale POR ITEM do Escopo (ver `calcularMaoObraPorItens`, é o que o
// orçamento usa) — cada reta/curva/plano tem a própria eficiência, e os m²
// equivalentes dos itens são somados. Altura e remoção do isolamento
// existente (migração 051) valem pro trecho inteiro.
//
// Os fatores SEMPRE se multiplicam entre si (nunca somam) — quanto mais
// condições difíceis (tubo fino + curva + altura), menor a eficiência e mais
// trabalho o mesmo m² exige.
//
// Transformar m² equivalentes em horas, dias e valor depende da EQUIPE da
// proposta (quantos funileiros/isoladores/ajudantes, rendimento e diária de
// cada função) — isso é feito uma vez para a proposta inteira, em
// maoObraEquipe.ts. Até a migração 048 este arquivo também calculava horas de
// uma dupla (m² ÷ m²/hora da dupla); esse modelo deixou de existir.

import type { ConfigEmpresa } from "../../types";
import type { FaixaDiametroTubulacao } from "./escopo";

export type ParametrosMaoObra = Pick<
  ConfigEmpresa,
  "eficiencia_tubulacao_pequena" | "eficiencia_tubulacao_media" | "eficiencia_curva" | "eficiencia_altura" | "eficiencia_fator_br" | "eficiencia_remocao"
>;

export interface FatoresMaoObra {
  /** `null` = sem item de tubulação/curva no trecho (só "plano") — mesmo
   * efeito de "grande" (>= 6"), eficiência 1, sem penalidade. */
  faixaDiametro: FaixaDiametroTubulacao | null;
  temCurvas: boolean;
  trabalhoAltura: boolean;
  /** O trecho inclui remover o isolamento existente (migração 051). */
  remocaoIsolamento?: boolean;
}

export interface MaoObraAutomatica {
  eficienciaGlobal: number;
  /** Metragem de projeto, sem ajuste. */
  metragemM2: number;
  /** Metragem ÷ eficiência — a medida de trabalho que vira horas e dias em
   * maoObraEquipe.ts. */
  m2Equivalente: number;
}

function eficienciaDe(fatores: FatoresMaoObra, parametros: ParametrosMaoObra): number {
  let eficiencia = 1;
  if (fatores.faixaDiametro === "pequena") eficiencia *= parametros.eficiencia_tubulacao_pequena;
  else if (fatores.faixaDiametro === "media") eficiencia *= parametros.eficiencia_tubulacao_media;
  // "grande" (>= 6") ou `null` (sem tubulação/curva, só "plano") — eficiência
  // 1, sem multiplicação.
  if (fatores.temCurvas) eficiencia *= parametros.eficiencia_curva;
  if (fatores.trabalhoAltura) eficiencia *= parametros.eficiencia_altura;
  // Sem o fator cadastrado (migração 051 não rodada) ou zerado, não penaliza.
  if (fatores.remocaoIsolamento && Number(parametros.eficiencia_remocao) > 0) eficiencia *= Number(parametros.eficiencia_remocao);
  eficiencia *= parametros.eficiencia_fator_br;
  return eficiencia;
}

const round4 = (n: number) => Number(n.toFixed(4));
const round2 = (n: number) => Number(n.toFixed(2));

const equivalente = (metragemM2: number, eficiencia: number) => (eficiencia > 0 ? metragemM2 / eficiencia : metragemM2);

/** Uma única eficiência pra metragem inteira — usada pelo cálculo por item
 * abaixo como bloco de construção (uma chamada por item do Escopo). */
export function calcularMaoObraAutomatica(metragemM2: number, fatores: FatoresMaoObra, parametros: ParametrosMaoObra): MaoObraAutomatica {
  const eficiencia = eficienciaDe(fatores, parametros);
  return {
    eficienciaGlobal: round4(eficiencia),
    metragemM2: round2(metragemM2),
    m2Equivalente: round2(equivalente(metragemM2, eficiencia)),
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

/** Trabalho do trecho calculado ITEM A ITEM (bug relatado: 100 m de
 * tubulação reta com 2 curvas dava o dobro do tempo, porque o fator de curva
 * — e o menor diâmetro — era aplicado sobre a metragem INTEIRA do trecho).
 * Cada item usa a eficiência que é dele: a reta só com o fator do próprio
 * diâmetro, a curva com o fator do diâmetro × fator de curva; o plano sem
 * fator de diâmetro nem de curva. Os m² equivalentes de cada item são somados.
 *
 * `eficienciaGlobal` devolvido é a eficiência MÉDIA PONDERADA (m² ÷ m²
 * equivalentes) — o número que a Tela 4 mostra como "eficiência" e que é
 * salvo no trecho; em trecho com um item só (ou todos iguais) coincide
 * exatamente com a eficiência única. */
export function calcularMaoObraPorItens(
  itens: ItemMaoObra[],
  trabalhoAltura: boolean,
  parametros: ParametrosMaoObra,
  remocaoIsolamento = false
): MaoObraAutomatica {
  let totalM2 = 0;
  let totalEquivalente = 0;

  for (const item of itens) {
    const eficiencia = eficienciaDe({ faixaDiametro: item.faixaDiametro, temCurvas: item.ehCurva, trabalhoAltura, remocaoIsolamento }, parametros);
    totalM2 += item.metragemM2;
    totalEquivalente += equivalente(item.metragemM2, eficiencia);
  }

  // Sem nenhum item com metragem, cai na eficiência "só altura × fator BR".
  const eficienciaMedia =
    totalEquivalente > 0
      ? totalM2 / totalEquivalente
      : eficienciaDe({ faixaDiametro: null, temCurvas: false, trabalhoAltura, remocaoIsolamento }, parametros);

  return {
    eficienciaGlobal: round4(eficienciaMedia),
    metragemM2: round2(totalM2),
    m2Equivalente: round2(totalEquivalente),
  };
}
