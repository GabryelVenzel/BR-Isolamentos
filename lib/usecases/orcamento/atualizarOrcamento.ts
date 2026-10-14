// Use case: atualizar um orçamento existente. Dois usos:
//
//   - só campos do cabeçalho (ex.: status) — os trechos não são tocados;
//   - edição completa pelo wizard ("Editar" reabre o orçamento como se
//     estivesse sendo orçado do zero): vem com `itens`, que SUBSTITUEM os
//     trechos atuais, e com a cópia do wizard (`wizard_estado`, migração 049).
//
// Sem restrição de transição de status: qualquer status pode virar qualquer
// outro por decisão manual do operador (ex.: reabrir um orçamento
// "rejeitado"). Número e data de criação nunca mudam numa edição.

import { NotFoundError } from "../../errors";
import type { OrcamentoRepository } from "../../repositories";
import type { ItemOrcamento, Orcamento } from "../../types";
import { UpdateOrcamentoSchema, parseOrThrow } from "../../validators";

export async function atualizarOrcamento(
  id: number | string,
  dados: Partial<Orcamento> & { wizard_estado?: unknown },
  repos: { orcamentoRepo: OrcamentoRepository }
): Promise<Orcamento> {
  const existente = await repos.orcamentoRepo.findById(id);
  if (!existente) throw new NotFoundError(`Orçamento ${id} não encontrado.`);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, cliente: _cliente, numero: _numero, numero_orcamento: _codigo, ...campos } = dados as Partial<Orcamento> & Record<string, unknown>;
  const { itens, wizard_estado, ...cabecalho } = parseOrThrow(UpdateOrcamentoSchema, campos);

  const atualizado =
    Array.isArray(itens) && itens.length > 0
      ? await repos.orcamentoRepo.atualizarComItens(id, cabecalho as Partial<Orcamento>, itens as Array<Partial<ItemOrcamento>>)
      : await repos.orcamentoRepo.update(id, cabecalho as Partial<Orcamento>);

  if (wizard_estado != null) await repos.orcamentoRepo.salvarEstadoWizard(id, wizard_estado);
  return atualizado;
}
