import type { LancamentoFinanceiroRepository } from "../../repositories";
import type { LancamentoFinanceiro } from "../../types/domain";
import { CreateLancamentoSchema, parseOrThrow } from "../../validators";

/** Registra um lançamento de receita/despesa. NUNCA recalcula imposto — se
 * `orcamento_id` for informado, o valor do lançamento deve vir do próprio
 * orçamento (já com o imposto real aplicado, ver lib/tributos.ts), não de um
 * cálculo novo aqui. */
export async function criarLancamento(
  input: unknown,
  repos: { lancamentoRepo: LancamentoFinanceiroRepository }
): Promise<LancamentoFinanceiro> {
  const dados = parseOrThrow(CreateLancamentoSchema, input);
  return repos.lancamentoRepo.create(dados as Partial<LancamentoFinanceiro>);
}
