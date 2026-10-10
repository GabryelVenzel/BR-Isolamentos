import type { LancamentoFinanceiroRepository } from "../../repositories";
import type { LancamentoFinanceiro } from "../../types/domain";
import { gerarParcelas, gerarRecorrencia } from "../../financeiro";
import { CreateLancamentoSchema, parseOrThrow } from "../../validators";

/** Registra um lançamento de receita/despesa — ou vários de uma vez, quando
 * vem `parcelas` (divide o valor em N vencimentos mensais) ou
 * `repetir_meses` (repete o valor cheio por N meses); ver lib/financeiro.ts.
 * Devolve o primeiro lançamento criado.
 *
 * NUNCA recalcula imposto — se `orcamento_id` for informado, o valor do
 * lançamento deve vir do próprio orçamento (já com o imposto real aplicado,
 * ver lib/tributos.ts), não de um cálculo novo aqui. */
export async function criarLancamento(
  input: unknown,
  repos: { lancamentoRepo: LancamentoFinanceiroRepository }
): Promise<LancamentoFinanceiro> {
  const { parcelas, repetir_meses, ...dados } = parseOrThrow(CreateLancamentoSchema, input);

  if (!parcelas && !repetir_meses) {
    return repos.lancamentoRepo.create(dados as Partial<LancamentoFinanceiro>);
  }

  const base = {
    descricao: dados.descricao,
    valor: dados.valor,
    data: dados.data,
    data_competencia: dados.data_competencia ?? dados.data,
  };
  const geradas = parcelas ? gerarParcelas(base, parcelas) : gerarRecorrencia(base, repetir_meses!);
  const grupoId = crypto.randomUUID();

  const linhas = geradas.map((parcela, indice) => ({
    ...dados,
    ...parcela,
    grupo_id: grupoId,
    grupo_tipo: parcelas ? ("parcelado" as const) : ("recorrente" as const),
    // "Já pago" e os anexos valem só para o primeiro — os demais ainda vão vencer.
    pago: indice === 0 ? dados.pago ?? false : false,
    data_pagamento: indice === 0 ? dados.data_pagamento ?? null : null,
    anexos: indice === 0 ? dados.anexos ?? [] : [],
  }));

  const criados = await repos.lancamentoRepo.createMany(linhas as Array<Partial<LancamentoFinanceiro>>);
  return criados[0];
}
