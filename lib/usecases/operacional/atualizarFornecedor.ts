import { NotFoundError } from "../../errors";
import type { FornecedorRepository } from "../../repositories";
import type { Fornecedor } from "../../types/domain";
import { UpdateFornecedorSchema, parseOrThrow } from "../../validators";

export async function atualizarFornecedor(
  id: string,
  dados: unknown,
  repos: { fornecedorRepo: FornecedorRepository }
): Promise<Fornecedor> {
  const existente = await repos.fornecedorRepo.findById(id);
  if (!existente) throw new NotFoundError(`Fornecedor ${id} não encontrado.`);

  const validados = parseOrThrow(UpdateFornecedorSchema, dados);
  return repos.fornecedorRepo.update(id, validados as Partial<Fornecedor>);
}
