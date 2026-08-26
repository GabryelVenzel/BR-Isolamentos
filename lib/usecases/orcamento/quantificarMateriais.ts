// Quantificação de materiais por trecho (migração 019) — puro, sem I/O.
// Toda fórmula parte da metragem TOTAL do trecho (m²), com os parâmetros
// configuráveis em Configurar Preços (ConfigEmpresa) — nunca hardcoded, pra
// o dono da empresa poder ajustar sem precisar de um novo deploy.
//
// Reaproveita os itens NOVOS do catálogo comercial (acessorio_arame/
// acessorio_parafuso/acessorio_rebite/acessorio_silicone, migrações 016/017)
// pra precificar rebite/parafuso/arame/silicone — não inventa uma tabela de
// preços paralela pra isso.

import type { ConfigEmpresa } from "../../types";

export interface QuantificacaoMateriais {
  /** m² de isolante a comprar (metragem × acréscimo) — não é a metragem "de
   * projeto", é a quantidade com folga de sobra/traspasse. */
  isolanteM2: number;
  acabamentoM2: number;
  /** Unidades — arredondado pra cima (não dá pra comprar "meio rebite"). */
  rebiteUn: number;
  parafusoUn: number;
  arameGramas: number;
  /** Frascos — arredondado pra cima. */
  siliconeFrascos: number;
}

/** Parâmetros de quantificação isolados de `ConfigEmpresa` — assinatura
 * explícita em vez de aceitar o objeto inteiro, pra deixar claro quais
 * campos esta função realmente usa (e facilitar teste sem montar um
 * ConfigEmpresa completo). */
export type ParametrosQuantificacao = Pick<
  ConfigEmpresa,
  | "isolante_acrescimo_percentual"
  | "acabamento_acrescimo_percentual"
  | "rebite_por_m2"
  | "parafusos_por_m2"
  | "arame_gramas_por_m2"
  | "silicone_intervalo_m2"
>;

export function quantificarMateriais(metragemM2: number, parametros: ParametrosQuantificacao): QuantificacaoMateriais {
  const round2 = (n: number) => Number(n.toFixed(2));

  return {
    isolanteM2: round2(metragemM2 * (1 + parametros.isolante_acrescimo_percentual / 100)),
    acabamentoM2: round2(metragemM2 * (1 + parametros.acabamento_acrescimo_percentual / 100)),
    rebiteUn: Math.round(metragemM2 * parametros.rebite_por_m2),
    parafusoUn: Math.round(metragemM2 * parametros.parafusos_por_m2),
    arameGramas: round2(metragemM2 * parametros.arame_gramas_por_m2),
    // ROUND, não CEIL — segue a fórmula exata do pedido ("Security States
    // Grave"), mesmo que arredondar pra baixo signifique comprar frascos a
    // menos numa metragem ímpar (ex.: 3m² ÷ 2 = 1,5 → 2, mas 2,9m² ÷ 2 =
    // 1,45 → 1). Ajustável em Configurar Preços se precisar mudar o critério.
    siliconeFrascos:
      parametros.silicone_intervalo_m2 > 0 ? Math.round(metragemM2 / parametros.silicone_intervalo_m2) : 0,
  };
}
