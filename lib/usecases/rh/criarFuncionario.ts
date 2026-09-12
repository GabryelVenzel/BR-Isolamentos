import type { FuncionarioRepository } from "../../repositories";
import type { Funcionario } from "../../types/domain";
import { CreateFuncionarioSchema, parseOrThrow } from "../../validators";

export async function criarFuncionario(input: unknown, repos: { funcionarioRepo: FuncionarioRepository }): Promise<Funcionario> {
  const dados = parseOrThrow(CreateFuncionarioSchema, input);
  return repos.funcionarioRepo.create(dados as Partial<Funcionario>);
}
