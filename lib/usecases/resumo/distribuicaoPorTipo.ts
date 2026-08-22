import type { OrcamentoRepository } from "../../repositories";
import type { DistribuicaoTipoResumo } from "../../types/resumo";
import type { IntervaloData } from "./periodo";

const LABELS: Record<string, string> = { quente: "Quente", frio: "Frio", misto: "Misto" };

/**
 * Mix de vendas por tipo de trabalho (quente/frio/misto) no período — soma
 * `valor_final` de orçamentos ACEITOS (não `lancamentos_financeiros`: nem
 * todo orçamento aceito tem lançamento financeiro vinculado ainda, então a
 * receita "efetivamente registrada" pode não refletir o mix real de vendas;
 * o valor de venda do próprio orçamento é a fonte mais completa disponível
 * pra esse indicador específico — ver comentário em
 * `OrcamentoRepository.listarAceitosPorPeriodo`).
 */
export async function distribuicaoPorTipo(
  orcamentoRepo: OrcamentoRepository,
  intervalo: IntervaloData,
  responsavel?: string
): Promise<DistribuicaoTipoResumo[]> {
  const orcamentos = await orcamentoRepo.listarAceitosPorPeriodo(intervalo.dataInicio, intervalo.dataFim, responsavel);

  const somaPorTipo = new Map<string, number>();
  let total = 0;
  for (const o of orcamentos) {
    somaPorTipo.set(o.tipo_trabalho, (somaPorTipo.get(o.tipo_trabalho) ?? 0) + o.valor_final);
    total += o.valor_final;
  }

  return Array.from(somaPorTipo.entries())
    .map(([tipo, valor]) => ({
      tipo: tipo as DistribuicaoTipoResumo["tipo"],
      label: LABELS[tipo] ?? tipo,
      valor,
      percentual: total > 0 ? (valor / total) * 100 : 0,
    }))
    .sort((a, b) => b.valor - a.valor);
}
