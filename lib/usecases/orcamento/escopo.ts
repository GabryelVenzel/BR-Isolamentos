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
