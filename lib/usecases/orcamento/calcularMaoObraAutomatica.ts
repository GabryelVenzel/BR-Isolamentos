// Mão de obra automática por trecho (migração 019) — substitui o campo
// manual "Mão de obra deste trecho (horas)" que existia no wizard. Puro, sem
// I/O. Fórmula do pedido ("Security States Grave"):
//
//   eficiência_global = (tubulação<4" ? fator : 1) × (curvas ? fator : 1) ×
//                        (altura ? fator : 1) × fator_br  [sempre aplicado]
//   horas_base        = m² ÷ m²_por_hora_dupla
//   horas_ajustadas   = horas_base ÷ eficiência_global
//   dias_necessarios  = horas_ajustadas ÷ horas_úteis_dia
//
// Os fatores SEMPRE se multiplicam entre si (nunca somam) — quanto mais
// condições difíceis (tubo fino + curva + altura), menor a eficiência e mais
// horas o mesmo m² exige. Referência de base: 1 dupla (2 pessoas) = 2m²/hora
// a 100% de eficiência — este cálculo já assume no mínimo 1 dupla, nunca
// menos.

import type { ConfigEmpresa } from "../../types";

export type ParametrosMaoObra = Pick<
  ConfigEmpresa,
  | "m2_por_hora_dupla"
  | "eficiencia_tubulacao_pequena"
  | "eficiencia_curva"
  | "eficiencia_altura"
  | "eficiencia_fator_br"
  | "horas_uteis_dia"
>;

export interface FatoresMaoObra {
  tubulacaoPequena: boolean;
  temCurvas: boolean;
  trabalhoAltura: boolean;
}

export interface MaoObraAutomatica {
  eficienciaGlobal: number;
  horasBase: number;
  horasAjustadas: number;
  diasNecessarios: number;
}

export function calcularMaoObraAutomatica(
  metragemM2: number,
  fatores: FatoresMaoObra,
  parametros: ParametrosMaoObra
): MaoObraAutomatica {
  let eficiencia = 1;
  if (fatores.tubulacaoPequena) eficiencia *= parametros.eficiencia_tubulacao_pequena;
  if (fatores.temCurvas) eficiencia *= parametros.eficiencia_curva;
  if (fatores.trabalhoAltura) eficiencia *= parametros.eficiencia_altura;
  eficiencia *= parametros.eficiencia_fator_br;

  const horasBase = parametros.m2_por_hora_dupla > 0 ? metragemM2 / parametros.m2_por_hora_dupla : 0;
  const horasAjustadas = eficiencia > 0 ? horasBase / eficiencia : horasBase;
  const diasNecessarios = parametros.horas_uteis_dia > 0 ? horasAjustadas / parametros.horas_uteis_dia : 0;

  const round4 = (n: number) => Number(n.toFixed(4));
  const round2 = (n: number) => Number(n.toFixed(2));

  return {
    eficienciaGlobal: round4(eficiencia),
    horasBase: round2(horasBase),
    horasAjustadas: round2(horasAjustadas),
    diasNecessarios: round2(diasNecessarios),
  };
}
