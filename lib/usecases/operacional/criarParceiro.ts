import type { ParceiroRepository } from "../../repositories";
import type { Parceiro } from "../../types/domain";
import { CreateParceiroSchema, parseOrThrow } from "../../validators";

export async function criarParceiro(input: unknown, repos: { parceiroRepo: ParceiroRepository }): Promise<Parceiro> {
  const dados = parseOrThrow(CreateParceiroSchema, input);
  return repos.parceiroRepo.create(dados as Partial<Parceiro>);
}
