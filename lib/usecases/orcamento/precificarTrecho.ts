// Precificação de um trecho (Tela 4 do wizard) e alocação proporcional do
// valor final do orçamento entre trechos (Tela 5/6) — puro, sem I/O.
//
// IMPORTANTE: a Tela 4 do pedido original mostrava um exemplo com margem
// fixa de 20% aplicada trecho a trecho. Isso NÃO é usado aqui — o motor de
// impostos/margem (lib/orcamento.ts#calcularOrcamento) já é sofisticado
// (regime tributário configurável, Simples Nacional com alíquota real por
// RBT12, impostos extras, margem configurável) e opera sobre o ORÇAMENTO
// INTEIRO, não trecho a trecho (o regime tributário não muda de trecho para
// trecho). Reaproveitar esse motor — em vez de aplicar uma margem ingênua
// de 20% por trecho — é o que preserva a exigência já validada com o
// usuário de que o cálculo considere a carga tributária real e completa.
// `alocarValorFinalPorTrecho` só REPARTE o resultado desse motor entre os
// trechos (proporcional ao custo de cada um), para exibição — não recalcula
// impostos/margem por conta própria.

import type { ItemEscopo } from "../../types";
import { somarMetragemEscopo } from "./escopo";

export interface PrecificacaoTrecho {
  metragem_m2: number;
  preco_isolante_m2: number;
  preco_acabamento_m2: number;
  horas_mao_obra: number;
  valor_hora_mao_obra: number;
  subtotal_material: number;
  subtotal_mao_obra: number;
  subtotal_trecho: number;
}

export function precificarTrecho(input: {
  escopoItens: ItemEscopo[];
  precoIsolanteM2: number;
  precoAcabamentoM2: number;
  horasMaoObra: number;
  valorHoraMaoObra: number;
}): PrecificacaoTrecho {
  const metragem = somarMetragemEscopo(input.escopoItens);
  const round2 = (n: number) => Number(n.toFixed(2));

  const subtotalMaterial = round2(metragem * (input.precoIsolanteM2 + input.precoAcabamentoM2));
  const subtotalMaoObra = round2(input.horasMaoObra * input.valorHoraMaoObra);

  return {
    metragem_m2: metragem,
    preco_isolante_m2: input.precoIsolanteM2,
    preco_acabamento_m2: input.precoAcabamentoM2,
    horas_mao_obra: input.horasMaoObra,
    valor_hora_mao_obra: input.valorHoraMaoObra,
    subtotal_material: subtotalMaterial,
    subtotal_mao_obra: subtotalMaoObra,
    subtotal_trecho: round2(subtotalMaterial + subtotalMaoObra),
  };
}

export interface TrechoParaAlocacao {
  subtotal_material: number;
  subtotal_mao_obra: number;
}

/** Reparte `valorFinalOrcamento` (já com impostos/margem/desconto do motor
 * completo) entre os trechos, proporcional ao custo (material + mão de obra)
 * de cada um — mesma % de imposto/margem "embutida" pra todos os trechos,
 * já que vem de um único cálculo por orçamento. Última linha absorve o
 * arredondamento, para a soma bater exatamente com o valor final. */
export function alocarValorFinalPorTrecho(trechos: TrechoParaAlocacao[], valorFinalOrcamento: number): number[] {
  const custos = trechos.map((t) => t.subtotal_material + t.subtotal_mao_obra);
  const custoTotal = custos.reduce((acc, c) => acc + c, 0);

  if (custoTotal <= 0) return trechos.map(() => 0);

  const valores = custos.map((c) => Number(((c / custoTotal) * valorFinalOrcamento).toFixed(2)));
  const diferenca = Number((valorFinalOrcamento - valores.reduce((acc, v) => acc + v, 0)).toFixed(2));
  valores[valores.length - 1] = Number((valores[valores.length - 1] + diferenca).toFixed(2));
  return valores;
}
