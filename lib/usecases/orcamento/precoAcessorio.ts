// Preço de um acessório do catálogo comercial (migrações 016/017) já
// convertido pra preço POR UNIDADE de quantidade — puro, sem I/O.
//
// Bug relatado: Rebite/Parafuso são cadastrados em Configurar Preços "por
// centena" (unidade `centena`), mas a quantificação calcula a quantidade em
// UNIDADES (un.) — o preço cru da centena era multiplicado pela quantidade
// em un., inflando o valor 100×. Aqui a quantidade continua em unidades (é
// o que o usuário vê e pode editar), só o preço é convertido (÷ 100) pra
// bater com ela. Arame (por metro) e silicone (por frasco) já estão na mesma
// unidade da quantidade, então passam direto.

import type { PrecoConfig } from "../../types";

export function precoAcessorioPorUnidade(precos: PrecoConfig[], tipoMaterial: string): number {
  const item = precos.find((p) => p.tipo_material === tipoMaterial);
  if (!item) return 0;
  return item.unidade === "centena" ? item.preco_unitario / 100 : item.preco_unitario;
}
