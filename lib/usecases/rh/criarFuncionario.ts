import type { FuncionarioDadosRepository, FuncionarioRepository } from "../../repositories";
import type { Funcionario, FuncionarioDados } from "../../types/domain";
import { CreateFuncionarioSchema, parseOrThrow } from "../../validators";

/** Cadastra o funcionário e, se vierem, os dados sensíveis (migração 052 —
 * tabela à parte, só o módulo RH lê). */
export async function criarFuncionario(
  input: unknown,
  repos: { funcionarioRepo: FuncionarioRepository; funcionarioDadosRepo?: FuncionarioDadosRepository }
): Promise<Funcionario> {
  const { dados, ...cadastro } = parseOrThrow(CreateFuncionarioSchema, input);
  const funcionario = await repos.funcionarioRepo.create(cadastro as Partial<Funcionario>);
  if (dados && repos.funcionarioDadosRepo) await repos.funcionarioDadosRepo.salvar(funcionario.id, dados as Partial<FuncionarioDados>);
  return funcionario;
}
