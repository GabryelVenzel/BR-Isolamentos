// Itens de execução PADRÃO do orçamento (migração 051) — puro, sem I/O.
//
// Equipamentos e serviços de apoio que se repetem de obra em obra (andaime,
// plataforma elevatória, guindauto, linha de vida...). Ficam num catálogo em
// Configurar Preços (`ConfigEmpresa.itens_execucao_padrao`) e, em cada
// orçamento, são só HABILITADOS — com quantidade e, se precisar, preço
// ajustado. Valem para o orçamento inteiro (etapa "Equipe e custos"), não por
// trecho.
//
// O que cada estado faz na proposta (ver `escopoContemplado` em
// analiseProposta.ts):
//   - habilitado     → entra no custo de execução, no quadro "Itens
//                      Adicionais de Execução" e em "O orçamento contempla";
//   - não habilitado → é citado em "Não contemplado".
//
// Os "Itens Adicionais" livres da Tela 4 continuam existindo para o que não
// está no catálogo — e também contam como contemplados.

import type { ItemExecucaoOrcamento, ItemExecucaoPadrao } from "../../types";

/** O que o usuário escolheu para um item do catálogo neste orçamento. */
export interface EscolhaItemExecucao {
  incluido: boolean;
  quantidade: number;
  /** `null` = o preço do catálogo. */
  precoUnitario: number | null;
}

export type EscolhasExecucao = Record<string, EscolhaItemExecucao>;

const round2 = (n: number) => Number(n.toFixed(2));

/** Catálogo válido: só entradas com id e nome. */
export function catalogoItensExecucao(bruto: unknown): ItemExecucaoPadrao[] {
  if (!Array.isArray(bruto)) return [];
  return bruto
    .filter((i): i is ItemExecucaoPadrao => !!i && typeof i.id === "string" && typeof i.nome === "string" && i.nome.trim() !== "")
    .map((i) => ({ id: i.id, nome: i.nome.trim(), unidade: (i.unidade ?? "un.").trim() || "un.", preco: Number(i.preco) || 0 }));
}

/** O catálogo inteiro já cruzado com as escolhas do orçamento — é isto que
 * vai salvo em `orcamentos.itens_execucao` (os não incluídos também, para a
 * proposta saber o que citar em "Não contemplado" mesmo que o catálogo mude
 * depois). */
export function resolverItensExecucao(catalogo: ItemExecucaoPadrao[], escolhas: EscolhasExecucao | undefined): ItemExecucaoOrcamento[] {
  return catalogo.map((item) => {
    const escolha = escolhas?.[item.id];
    const incluido = !!escolha?.incluido;
    const quantidade = incluido ? Math.max(0, Number(escolha?.quantidade) || 0) : 0;
    const precoUnitario = Math.max(0, escolha?.precoUnitario ?? item.preco);
    return { id: item.id, nome: item.nome, unidade: item.unidade, incluido, quantidade, preco_unitario: precoUnitario, subtotal: incluido ? round2(quantidade * precoUnitario) : 0 };
  });
}

export function totalItensExecucao(itens: ItemExecucaoOrcamento[]): number {
  return round2(itens.reduce((acc, i) => acc + (i.incluido ? i.subtotal : 0), 0));
}

/** Quantidade sugerida ao habilitar um item: os dias de obra quando ele é
 * cobrado por diária (fica o tempo todo na obra), 1 nos demais. */
export function quantidadeInicialItemExecucao(item: Pick<ItemExecucaoPadrao, "unidade">, diasObra: number): number {
  return /di[áa]ria/i.test(item.unidade) && diasObra > 0 ? diasObra : 1;
}

/** Sugestão de catálogo — usada pela migração 051 (mesma lista) e como
 * ponto de partida em Configurar Preços quando o catálogo está vazio. Preços
 * zerados de propósito: cada empresa aluga por um valor. */
export const ITENS_EXECUCAO_SUGERIDOS: ItemExecucaoPadrao[] = [
  { id: "andaime", nome: "Andaime", unidade: "diária", preco: 0 },
  { id: "plataforma_elevatoria", nome: "Plataforma elevatória", unidade: "diária", preco: 0 },
  { id: "guindauto", nome: "Guindauto (caminhão munck)", unidade: "diária", preco: 0 },
  { id: "linha_de_vida", nome: "Linha de vida", unidade: "un.", preco: 0 },
  { id: "sinalizacao_area", nome: "Isolamento e sinalização de área", unidade: "verba", preco: 0 },
  { id: "cacamba_residuos", nome: "Caçamba para descarte de resíduos", unidade: "un.", preco: 0 },
  { id: "gerador", nome: "Gerador de energia", unidade: "diária", preco: 0 },
  { id: "iluminacao", nome: "Iluminação provisória", unidade: "diária", preco: 0 },
  { id: "ventilacao_confinado", nome: "Ventilação/exaustão para espaço confinado", unidade: "diária", preco: 0 },
  { id: "vigia_confinado", nome: "Vigia e resgate para espaço confinado", unidade: "diária", preco: 0 },
];
