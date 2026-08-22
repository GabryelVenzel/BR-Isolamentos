import { NotFoundError } from "../../errors";
import type { ParceiroRepository } from "../../repositories";
import type { Parceiro } from "../../types/domain";
import { UpdateParceiroSchema, parseOrThrow } from "../../validators";

export async function atualizarParceiro(
  id: string,
  dados: unknown,
  repos: { parceiroRepo: ParceiroRepository }
): Promise<Parceiro> {
  const existente = await repos.parceiroRepo.findById(id);
  if (!existente) throw new NotFoundError(`Parceiro ${id} não encontrado.`);

  const validados = parseOrThrow(UpdateParceiroSchema, dados);
  return repos.parceiroRepo.update(id, validados as Partial<Parceiro>);
}
