// Use case: persistir um orçamento completo (cabeçalho + itens) já calculado
// pelo wizard. Extraído de `app/api/orcamentos/route.ts` (POST) para reuso e
// para poder ser testado sem subir uma rota HTTP.

import type { ItemOrcamento, Orcamento } from "../../types";
import type { OrcamentoRepository } from "../../repositories";
import { CreateOrcamentoSchema, parseOrThrow } from "../../validators";

export interface CriarOrcamentoInput {
  cabecalho: Partial<Orcamento> & { cliente_id: number; itens: Array<Partial<ItemOrcamento>> };
  criadoPor: string | null;
}

export async function criarOrcamento(
  input: CriarOrcamentoInput,
  repos: { orcamentoRepo: OrcamentoRepository }
): Promise<Orcamento> {
  const { itens, wizard_estado, ...cabecalho } = parseOrThrow(CreateOrcamentoSchema, input.cabecalho);
  const orcamento = await repos.orcamentoRepo.criarComItens(cabecalho, itens, input.criadoPor);
  // Cópia do wizard, para "Editar" reabrir como foi montado (migração 049).
  if (wizard_estado != null) await repos.orcamentoRepo.salvarEstadoWizard(orcamento.id, wizard_estado);
  return orcamento;
}
