// Cálculos de metragem do Escopo de um trecho (Tela 2 do wizard de
// Orçamento) — puro, sem I/O, testável isoladamente.
//
// Fórmulas conforme especificadas no pedido original:
//   Tubulação: metragem = π × diâmetro(m) × comprimento(m)
//   Curva:     metragem/curva = π × diâmetro(m) × 1,5 × 0,5; total = × quantidade
//              (o exemplo numérico do pedido — "Ø100mm, qtd 2 → 4,3 m²" — não bate
//              com essa fórmula quando aplicada literalmente: dá 0,236 m²/curva,
//              não 2,15 m²/curva. Confirmado com o usuário: seguir a fórmula
//              escrita, não o número do exemplo — ver commit para o contexto.)
//   Plano:     metragem = entrada do usuário (sem fórmula)
//
// `metragemFinalItem`/`somarMetragemEscopo` acima são a área "de projeto"
// (do tubo/curva/plano nu) — é o que continua aparecendo na Proposta
// (Especificações Técnicas) e o que ainda alimenta a quantificação de
// rebite/parafuso/arame/silicone. `areaBaseIsolamentoItem`/
// `areaBaseIsolamentoEscopo` (migração 023) são uma área DIFERENTE, só para
// quantificar isolante/chaparia com mais precisão: a área da superfície JÁ
// ISOLADA (diâmetro do tubo + 2 espessuras de isolante), que é o que
// realmente precisa ser coberto de material — ver comentário na função.

import type { Geometria, ItemEscopo, TipoItemEscopo } from "../../types";

export function calcularMetragemTubulacao(diametroMm: number, comprimentoM: number): number {
  return Math.PI * (diametroMm / 1000) * comprimentoM;
}

const FATOR_CURVA = 1.5 * 0.5;

export function calcularMetragemCurva(diametroMm: number, quantidade: number): number {
  const metragemPorCurva = Math.PI * (diametroMm / 1000) * FATOR_CURVA;
  return metragemPorCurva * quantidade;
}

/** Metragem "calculada" pela fórmula do tipo — para "plano" é o próprio valor
 * manual informado (não há fórmula; ver cabeçalho do arquivo). */
export function calcularMetragemItem(item: {
  tipo: TipoItemEscopo;
  diametro_mm: number | null;
  comprimento_m: number | null;
  quantidade: number | null;
  metragem_manual_m2: number | null;
}): number {
  switch (item.tipo) {
    case "tubulacao":
      return calcularMetragemTubulacao(item.diametro_mm ?? 0, item.comprimento_m ?? 0);
    case "curva":
      return calcularMetragemCurva(item.diametro_mm ?? 0, item.quantidade ?? 0);
    case "plano":
      return item.metragem_manual_m2 ?? 0;
  }
}

/** Metragem final de um item de escopo: a calculada pela fórmula, ou a
 * manual quando `metragem_editada` está marcado (checkbox "editar metragem
 * manualmente" do pedido) — para "plano" as duas são sempre a mesma coisa,
 * já que não há fórmula própria. */
export function metragemFinalItem(item: ItemEscopo): number {
  if (item.tipo === "plano") return item.metragem_manual_m2 ?? 0;
  return item.metragem_editada ? (item.metragem_manual_m2 ?? 0) : calcularMetragemItem(item);
}

export function somarMetragemEscopo(itens: ItemEscopo[]): number {
  return Number(itens.reduce((acc, item) => acc + metragemFinalItem(item), 0).toFixed(2));
}

/** Diâmetro externo já isolado, em metros — soma 2 espessuras de isolante
 * ao diâmetro do tubo (a camada envolve o tubo por igual em toda a volta,
 * então cada lado "ganha" uma espessura). */
function diametroIsoladoM(diametroMm: number, espessuraMm: number): number {
  return (diametroMm + 2 * espessuraMm) / 1000;
}

/** Área de referência para quantificar ISOLANTE/CHAPARIA de um item de
 * Escopo (migração 023) — a área da superfície já isolada, não a do tubo
 * nu. Mesma fórmula de `calcularMetragemTubulacao`/`calcularMetragemCurva`,
 * só trocando o diâmetro do tubo pelo diâmetro já somado às 2 espessuras de
 * isolante (`diametroIsoladoM`).
 *
 * Plano não tem diâmetro pra "crescer" com a espessura (superfície plana,
 * não envolve nada) — usa a própria área do item. Item com metragem editada
 * manualmente (`metragem_editada`) cai no mesmo caso: não há como
 * decompor um número digitado à mão de volta em diâmetro/comprimento pra
 * recalcular. Nos dois casos, quem chama aplica o acréscimo percentual em
 * cima dessa mesma área (não fica sem nenhum acréscimo). */
export function areaBaseIsolamentoItem(item: ItemEscopo, espessuraMm: number): number {
  if (item.tipo === "plano" || item.metragem_editada) return metragemFinalItem(item);

  if (item.tipo === "tubulacao") {
    return Math.PI * diametroIsoladoM(item.diametro_mm ?? 0, espessuraMm) * (item.comprimento_m ?? 0);
  }

  // curva — mesmo "comprimento" fixo (Ø × 1,5 × 0,5) da fórmula original,
  // só que aplicado ao diâmetro já isolado.
  return Math.PI * diametroIsoladoM(item.diametro_mm ?? 0, espessuraMm) * FATOR_CURVA * (item.quantidade ?? 0);
}

/** Soma `areaBaseIsolamentoItem` de todos os itens do trecho — a área de
 * isolante/chaparia usada por `quantificarMateriais`. */
export function areaBaseIsolamentoEscopo(itens: ItemEscopo[], espessuraMm: number): number {
  return Number(itens.reduce((acc, item) => acc + areaBaseIsolamentoItem(item, espessuraMm), 0).toFixed(2));
}

/** 4 polegadas em milímetros — limiar de "tubulação pequena" pro fator de
 * eficiência de mão de obra (ver calcularMaoObraAutomatica.ts). */
const QUATRO_POLEGADAS_MM = 101.6;

/** true se o trecho tem qualquer item de escopo do tipo "curva" — derivado
 * do Escopo, não é um campo manual (ver decisão 2 em sql-migration-019). */
export function temCurvasNoEscopo(itens: ItemEscopo[]): boolean {
  return itens.some((item) => item.tipo === "curva");
}

/** true se o trecho tem tubulação/curva com diâmetro < 4" — mesmo raciocínio
 * de `temCurvasNoEscopo`: já dá pra saber isso pelo Escopo, sem pedir de
 * novo como checkbox manual. */
export function temTubulacaoPequena(itens: ItemEscopo[]): boolean {
  return itens.some(
    (item) => (item.tipo === "tubulacao" || item.tipo === "curva") && item.diametro_mm != null && item.diametro_mm < QUATRO_POLEGADAS_MM
  );
}

/** Um trecho pode misturar tipos de item no Escopo (ex.: tubo + curvas +
 * área plana, como no próprio exemplo do pedido) mas o cálculo térmico
 * (`calcularTermico`) precisa de UMA geometria (o coeficiente de convecção
 * depende disso). Escolhe a geometria "dominante": se houver qualquer
 * tubulação/curva no escopo, usa "tubulacao" com o diâmetro do primeiro item
 * desse tipo (aproximação de dimensionamento — a espessura resultante é
 * aplicada uniformemente à metragem total do trecho, igual o próprio
 * exemplo do pedido faz); senão, "plana". */
export function geometriaRepresentativa(itens: ItemEscopo[]): { geometria: Geometria; diametro_mm: number | null } {
  const comDiametro = itens.find((i) => (i.tipo === "tubulacao" || i.tipo === "curva") && i.diametro_mm);
  if (comDiametro) return { geometria: "tubulacao", diametro_mm: comDiametro.diametro_mm };
  return { geometria: "plana", diametro_mm: null };
}

const NOME_TIPO: Record<TipoItemEscopo, string> = {
  tubulacao: "Tubulação",
  curva: "Curva",
  plano: "Plano",
};

/** Quantidade "física" de um item de escopo, na unidade natural do tipo —
 * usada na coluna QTD. da tabela "Especificações Técnicas" das Propostas
 * (ex.: "25 m" de tubulação, "2 un." de curva). Diferente de
 * `metragemFinalItem`, que é sempre em m² (a área que entra no cálculo). */
export function quantidadeEscopoItem(item: ItemEscopo): string {
  switch (item.tipo) {
    case "tubulacao":
      return `${item.comprimento_m ?? "—"} m`;
    case "curva":
      return `${item.quantidade ?? "—"} un.`;
    case "plano":
      return "1";
  }
}

export function descreverItemEscopo(item: ItemEscopo): string {
  switch (item.tipo) {
    case "tubulacao":
      return `${NOME_TIPO.tubulacao} Ø${item.diametro_mm ?? "—"}mm, comprimento ${item.comprimento_m ?? "—"}m`;
    case "curva":
      return `${item.quantidade ?? "—"} curva(s) Ø${item.diametro_mm ?? "—"}mm`;
    case "plano":
      return `${NOME_TIPO.plano}`;
  }
}
