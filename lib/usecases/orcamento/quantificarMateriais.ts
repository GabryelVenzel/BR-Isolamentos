// Quantificação de materiais por trecho (migração 019, refinada na
// migração 023) — puro, sem I/O. Parâmetros configuráveis em Configurar
// Preços (ConfigEmpresa) — nunca hardcoded, pra o dono da empresa poder
// ajustar sem precisar de um novo deploy.
//
// Migração 023 — precisão de isolante/chaparia: antes, os dois eram
// calculados como um acréscimo percentual (20%/30%) direto sobre a área
// "de projeto" do tubo/curva/plano nu (a mesma que aparece na Proposta).
// Isso subestimava a área real a cobrir — o isolante e a chaparia envolvem
// o tubo JÁ ISOLADO (diâmetro maior que o tubo nu), não o tubo em si.
// Agora isolante/chaparia partem de `areaBaseIsolamentoEscopo` (ver
// escopo.ts): a área da superfície já isolada (diâmetro do tubo + 2
// espessuras de isolante, pra tubulação/curva; a própria área do item, pra
// plano ou item com metragem editada manualmente) — com um acréscimo
// percentual menor (novo padrão: 10%/20%, configurável, era 20%/30%) por
// cima dessa base mais precisa. Rebite/parafuso/arame/silicone continuam
// exatamente como antes, proporcionais à área "de projeto" total (pedido
// explícito: "o restante dos materiais continua com a mesma lógica").

import type { ConfigEmpresa, ItemEscopo } from "../../types";
import { areaBaseIsolamentoEscopo, somarMetragemEscopo } from "./escopo";

export interface QuantificacaoMateriais {
  /** m² de isolante a comprar (área já isolada × acréscimo) — não é a
   * metragem "de projeto" (do tubo nu), é a área que realmente precisa ser
   * coberta, com folga de sobra/traspasse. */
  isolanteM2: number;
  acabamentoM2: number;
  /** Unidades — arredondado pra cima (não dá pra comprar "meio rebite"). */
  rebiteUn: number;
  parafusoUn: number;
  /** Metros de arame (migração 029 — catálogo vende por metro, não mais por
   * peso). */
  arameMetros: number;
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
  | "arame_metros_por_m2"
  | "silicone_intervalo_m2"
>;

/** `espessuraMm` é a espessura de isolante do trecho (já calculada pelo
 * motor térmico, ou digitada pelo usuário em "outro material" customizado)
 * — usada só pra achar o diâmetro já isolado de itens tubulação/curva (ver
 * `areaBaseIsolamentoEscopo`). 0 é um valor válido (ex.: trecho sem
 * resultado térmico ainda) — nesse caso a área de isolamento cai de volta
 * na área do tubo nu, igual o comportamento anterior à migração 023. */
export function quantificarMateriais(escopoItens: ItemEscopo[], espessuraMm: number, parametros: ParametrosQuantificacao): QuantificacaoMateriais {
  const round2 = (n: number) => Number(n.toFixed(2));

  const areaIsolamento = areaBaseIsolamentoEscopo(escopoItens, espessuraMm);
  const metragemProjeto = somarMetragemEscopo(escopoItens);

  return {
    isolanteM2: round2(areaIsolamento * (1 + parametros.isolante_acrescimo_percentual / 100)),
    acabamentoM2: round2(areaIsolamento * (1 + parametros.acabamento_acrescimo_percentual / 100)),
    rebiteUn: Math.round(metragemProjeto * parametros.rebite_por_m2),
    parafusoUn: Math.round(metragemProjeto * parametros.parafusos_por_m2),
    arameMetros: round2(metragemProjeto * parametros.arame_metros_por_m2),
    // ROUND, não CEIL — segue a fórmula exata do pedido ("Security States
    // Grave"), mesmo que arredondar pra baixo signifique comprar frascos a
    // menos numa metragem ímpar (ex.: 3m² ÷ 2 = 1,5 → 2, mas 2,9m² ÷ 2 =
    // 1,45 → 1). Ajustável em Configurar Preços se precisar mudar o critério.
    siliconeFrascos: parametros.silicone_intervalo_m2 > 0 ? Math.round(metragemProjeto / parametros.silicone_intervalo_m2) : 0,
  };
}
