import { NotFoundError } from "../../errors";
import type { FuncionarioDadosRepository, FuncionarioRepository } from "../../repositories";
import type { Funcionario, FuncionarioDados } from "../../types/domain";
import { UpdateFuncionarioSchema, parseOrThrow } from "../../validators";

/** Atualiza o cadastro e, se vierem, os dados sensíveis (migração 052). */
export async function atualizarFuncionario(
  id: string,
  input: unknown,
  repos: { funcionarioRepo: FuncionarioRepository; funcionarioDadosRepo?: FuncionarioDadosRepository }
): Promise<Funcionario> {
  const existente = await repos.funcionarioRepo.findById(id);
  if (!existente) throw new NotFoundError(`Funcionário ${id} não encontrado.`);

  const { dados, ...cadastro } = parseOrThrow(UpdateFuncionarioSchema, input);
  const funcionario = Object.keys(cadastro).length > 0 ? await repos.funcionarioRepo.update(id, cadastro as Partial<Funcionario>) : existente;
  if (dados && repos.funcionarioDadosRepo) await repos.funcionarioDadosRepo.salvar(id, dados as Partial<FuncionarioDados>);
  return funcionario;
}
