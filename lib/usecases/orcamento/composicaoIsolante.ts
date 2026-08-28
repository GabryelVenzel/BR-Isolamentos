// Composição de camadas padrão de isolante (migração 025) — pura, sem I/O.
//
// CONTEXTO: o catálogo comercial (precos_config) deixou de ter uma lista
// enorme de combinações material×espessura livre — agora cada "família" de
// isolante (ex. "Feltro de Lã de Rocha 64kg/m³") só existe nas espessuras
// padrão que a empresa realmente compra (ex. 25mm e 51mm). Quando a
// espessura EXIGIDA pelo cálculo térmico (ou digitada pelo usuário, no
// quente) não é uma dessas espessuras padrão, ela precisa ser composta com
// 2+ camadas empilhadas da mesma família — ex.: 75mm de Lã de Rocha vira uma
// camada de 50mm + uma de 25mm, cada uma virando sua própria linha na
// quantificação, cada uma cobrindo a MESMA metragem total do trecho (pedido
// explícito do usuário: "com a metragem total e o valor de cada um").
//
// DECISÕES já validadas com o usuário antes de implementar (perguntas
// feitas de propósito, dado o impacto em custo/adequação técnica):
//   1) Arredondamento: SEMPRE pra cima — a composição nunca pode somar menos
//      que a espessura exigida, mesmo que isso implique um pequeno
//      sobrecusto de material (prioriza a adequação térmica).
//   2) Sem limite de número de camadas — o algoritmo busca a MENOR soma
//      possível >= exigida usando quantas camadas forem necessárias (busca
//      exaustiva por programação dinâmica, não greedy ingênuo: greedy pela
//      maior espessura primeiro erraria casos como 36mm no frio, onde 18+18
//      = 36mm exato é melhor que 25+25=50mm ou 25+18=43mm).
//   3) UX inalterada: a Tela 3 continua com o mesmo campo de espessura (livre
//      no quente, calculado no frio) — a composição acontece só "por baixo",
//      na Tela 4, ao montar a lista de quantificação.

export interface CamadaIsolante {
  /** Espessura padrão desta camada (mm) — uma das espessuras disponíveis da
   * família escolhida (ex.: 50, 25). */
  espessuraMm: number;
  /** Quantas camadas dessa espessura entram na composição (normalmente 1,
   * mas pode repetir — ex.: 100mm de Fibra Cerâmica com opções [25,50] vira
   * 2 camadas de 50mm, quantidadeCamadas = 2). */
  quantidadeCamadas: number;
}

/** Decompõe `espessuraNecessariaMm` em camadas das espessuras padrão
 * disponíveis (`espessurasDisponiveisMm`, tipicamente as espessuras
 * cadastradas para a família de isolante escolhida em Configurar Preços).
 * Sempre soma >= espessura exigida (nunca menos), buscando a MENOR soma
 * possível — e, entre somas empatadas, a que usa menos camadas.
 *
 * Retorna `[]` se a espessura exigida for <= 0 (ex.: trecho ainda sem
 * cálculo térmico) ou não houver nenhuma espessura disponível cadastrada.
 */
export function comporCamadasIsolante(espessuraNecessariaMm: number, espessurasDisponiveisMm: number[]): CamadaIsolante[] {
  const disponiveis = [...new Set(espessurasDisponiveisMm.filter((e) => e > 0))].sort((a, b) => b - a);
  const exigido = Math.ceil(espessuraNecessariaMm);
  if (exigido <= 0 || disponiveis.length === 0) return [];

  const maiorEspessura = disponiveis[0];
  // Limite superior seguro de busca: repetir só a maior espessura disponível
  // sempre alcança (ou ultrapassa) o exigido — não precisa buscar além disso.
  const limite = Math.ceil(exigido / maiorEspessura) * maiorEspessura;

  // Programação dinâmica: dp[s] = nº mínimo de camadas pra somar EXATAMENTE
  // `s` mm; ultimaCamada[s] = qual espessura foi usada por último nessa
  // solução mínima (permite reconstruir a composição depois).
  const dp = new Array<number>(limite + 1).fill(Infinity);
  const ultimaCamada = new Array<number>(limite + 1).fill(0);
  dp[0] = 0;
  for (let soma = 1; soma <= limite; soma++) {
    for (const espessura of disponiveis) {
      if (espessura <= soma && dp[soma - espessura] + 1 < dp[soma]) {
        dp[soma] = dp[soma - espessura] + 1;
        ultimaCamada[soma] = espessura;
      }
    }
  }

  // Primeira soma alcançável >= exigido (a menor sobra possível).
  let alvo = limite;
  for (let soma = Math.min(exigido, limite); soma <= limite; soma++) {
    if (dp[soma] < Infinity) {
      alvo = soma;
      break;
    }
  }

  const contagemPorEspessura = new Map<number, number>();
  let restante = alvo;
  while (restante > 0) {
    const espessura = ultimaCamada[restante];
    contagemPorEspessura.set(espessura, (contagemPorEspessura.get(espessura) ?? 0) + 1);
    restante -= espessura;
  }

  return [...contagemPorEspessura.entries()]
    .sort(([a], [b]) => b - a)
    .map(([espessuraMm, quantidadeCamadas]) => ({ espessuraMm, quantidadeCamadas }));
}

/** Soma total (mm) de uma composição — útil pra exibir "Total: 75mm (50mm +
 * 25mm)" e pra comparar com a espessura exigida original (detectar sobra). */
export function espessuraTotalComposicao(camadas: CamadaIsolante[]): number {
  return camadas.reduce((acc, c) => acc + c.espessuraMm * c.quantidadeCamadas, 0);
}
