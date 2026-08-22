// Use case: atualizar campos de um orçamento existente (status, margem,
// desconto — ver `app/orcamento/[id]/editar/page.tsx`). Sem restrição de
// transição de status: qualquer status pode virar qualquer outro por decisão
// manual do operador (ex.: reabrir um orçamento "rejeitado"), então o único
// papel deste use case é confirmar que o registro existe antes de tentar
// gravar, delegando a validação de forma para o schema.

import { NotFoundError } from "../../errors";
import type { OrcamentoRepository } from "../../repositories";
import type { Orcamento } from "../../types";
import { UpdateOrcamentoSchema, parseOrThrow } from "../../validators";

export async function atualizarOrcamento(
  id: number | string,
  dados: Partial<Orcamento>,
  repos: { orcamentoRepo: OrcamentoRepository }
): Promise<Orcamento> {
  const existente = await repos.orcamentoRepo.findById(id);
  if (!existente) throw new NotFoundError(`Orçamento ${id} não encontrado.`);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, cliente: _cliente, itens: _itens, ...campos } = dados;
  const validados = parseOrThrow(UpdateOrcamentoSchema, campos);

  return repos.orcamentoRepo.update(id, validados as Partial<Orcamento>);
}
