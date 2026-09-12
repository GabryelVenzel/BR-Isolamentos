import { NotFoundError } from "../../errors";
import type { FuncionarioAnexoRepository } from "../../repositories";
import type { FuncionarioAnexo } from "../../types/domain";
import { UpdateFuncionarioAnexoSchema, parseOrThrow } from "../../validators";

/** Renomeia um documento de funcionário já anexado — mesma ideia de
 * renomearDocumentoEmpresa.ts. */
export async function renomearAnexoFuncionario(
  id: string,
  dados: unknown,
  repos: { funcionarioAnexoRepo: FuncionarioAnexoRepository }
): Promise<FuncionarioAnexo> {
  const existente = await repos.funcionarioAnexoRepo.findById(id);
  if (!existente) throw new NotFoundError(`Anexo ${id} não encontrado.`);

  const validados = parseOrThrow(UpdateFuncionarioAnexoSchema, dados);
  return repos.funcionarioAnexoRepo.update(id, validados as Partial<FuncionarioAnexo>);
}
