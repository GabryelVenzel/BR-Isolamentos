import { NotFoundError } from "../../errors";
import type { FuncionarioRepository } from "../../repositories";
import type { Funcionario } from "../../types/domain";
import { UpdateFuncionarioSchema, parseOrThrow } from "../../validators";

export async function atualizarFuncionario(
  id: string,
  dados: unknown,
  repos: { funcionarioRepo: FuncionarioRepository }
): Promise<Funcionario> {
  const existente = await repos.funcionarioRepo.findById(id);
  if (!existente) throw new NotFoundError(`Funcionário ${id} não encontrado.`);

  const validados = parseOrThrow(UpdateFuncionarioSchema, dados);
  return repos.funcionarioRepo.update(id, validados as Partial<Funcionario>);
}
