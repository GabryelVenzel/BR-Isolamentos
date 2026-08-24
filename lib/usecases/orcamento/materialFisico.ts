// Ponte entre o catálogo COMERCIAL (precos_config, migração 010 — preço por
// m² nas densidades pedidas pelo usuário: Fibra Cerâmica 64/96/128,
// Lã de Rocha 50/75/100, Espuma 40/50/60 kg/m³) e o catálogo FÍSICO
// (materiais_isolantes, dados pesquisados em materials_internal.py, com a
// fórmula k(T) usada no cálculo térmico).
//
// As densidades dos dois catálogos NÃO batem 1:1 (ex.: `materiais_isolantes`
// só tem Lã de Rocha em 32/48/64kg/m³, não 50/75/100) porque um é dado de
// engenharia pesquisado e o outro é o catálogo comercial que o usuário pediu
// — não têm por que ser idênticos, e não posso inventar coeficientes k(T)
// novos para densidades sem fonte. Por isso a física usa, dentro da mesma
// categoria, o material PESQUISADO de densidade mais próxima da densidade
// COMERCIAL escolhida.

import type { MaterialIsolante, TipoMaterialPreco } from "../../types";

const CATEGORIA_POR_TIPO: Partial<Record<TipoMaterialPreco, string>> = {
  isolante_fibra_ceramica: "Fibra Cerâmica",
  isolante_la_rocha: "Lã de Rocha",
  isolante_espuma: "Outros Isolantes", // materiais_isolantes só tem "Espuma Elastomérica" nessa categoria
};

/** Dado o tipo comercial (ex. "isolante_la_rocha") e a densidade escolhida
 * (ex. 75), acha o material FÍSICO pesquisado de densidade mais próxima
 * dentro da mesma família — para alimentar o k(T) do cálculo térmico. */
export function materialFisicoMaisProximo(
  tipoComercial: TipoMaterialPreco,
  densidadeAlvoKgM3: number,
  materiaisIsolantes: MaterialIsolante[]
): MaterialIsolante | null {
  const categoria = CATEGORIA_POR_TIPO[tipoComercial];
  if (!categoria) return null;

  let candidatos = materiaisIsolantes.filter((m) => m.categoria === categoria && m.ativo);
  if (categoria === "Outros Isolantes") {
    candidatos = candidatos.filter((m) => m.nome.includes("Espuma Elastomérica"));
  }
  if (candidatos.length === 0) return null;

  return candidatos.reduce((maisProximo, atual) =>
    Math.abs(atual.densidade_kg_m3 - densidadeAlvoKgM3) < Math.abs(maisProximo.densidade_kg_m3 - densidadeAlvoKgM3)
      ? atual
      : maisProximo
  );
}

const PALAVRA_CHAVE_POR_TIPO: Partial<Record<TipoMaterialPreco, string>> = {
  chaparia_inox: "Inox",
  chaparia_galvanizado: "Galvanizado",
  chaparia_aluminio: "Alumínio",
};

/** Dado o tipo comercial de chaparia (ex. "chaparia_inox"), acha o
 * acabamento FÍSICO (tabela `acabamentos`, com a emissividade usada na
 * física de radiação) cujo nome contém a mesma palavra-chave — preferindo
 * a variante "Novo/Polido" (produto novo, o caso padrão de uma obra). */
export function acabamentoFisicoMaisProximo(
  tipoComercial: TipoMaterialPreco,
  acabamentos: Array<{ id: number; nome: string; emissividade: number; ativo: boolean }>
) {
  const palavraChave = PALAVRA_CHAVE_POR_TIPO[tipoComercial];
  if (!palavraChave) return null;

  const candidatos = acabamentos.filter((a) => a.ativo && a.nome.includes(palavraChave));
  if (candidatos.length === 0) return null;

  const novo = candidatos.find((a) => a.nome.includes("Novo") || a.nome.includes("Polido"));
  return novo ?? candidatos[0];
}
