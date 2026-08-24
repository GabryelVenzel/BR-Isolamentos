import type { FornecedorRepository } from "../../repositories";
import type { Fornecedor } from "../../types/domain";
import { CreateFornecedorSchema, parseOrThrow } from "../../validators";

export async function criarFornecedor(input: unknown, repos: { fornecedorRepo: FornecedorRepository }): Promise<Fornecedor> {
  const dados = parseOrThrow(CreateFornecedorSchema, input);
  return repos.fornecedorRepo.create(dados as Partial<Fornecedor>);
}
