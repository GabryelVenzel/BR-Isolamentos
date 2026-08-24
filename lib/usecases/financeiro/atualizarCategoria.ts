import { ConflictError, NotFoundError } from "../../errors";
import type { CategoriaLancamentoRepository } from "../../repositories";
import type { CategoriaLancamento } from "../../types/domain";
import { UpdateCategoriaLancamentoSchema, parseOrThrow } from "../../validators";

/** Renomear uma categoria protegida é bloqueado — o nome é o que aparece
 * gravado em todo lançamento antigo (texto livre, não FK — ver decisão 2 na
 * migração 009); renomear silenciosamente desalinharia o histórico com o
 * nome atual. Desativar (`ativo: false`) continua permitido mesmo em
 * protegida — é o jeito de "aposentar" sem quebrar nada. */
export async function atualizarCategoria(
  id: string,
  dados: unknown,
  repos: { categoriaRepo: CategoriaLancamentoRepository }
): Promise<CategoriaLancamento> {
  const existente = await repos.categoriaRepo.findById(id);
  if (!existente) throw new NotFoundError(`Categoria ${id} não encontrada.`);

  const validados = parseOrThrow(UpdateCategoriaLancamentoSchema, dados);
  if (existente.protegida && validados.nome && validados.nome !== existente.nome) {
    throw new ConflictError("Categorias pré-definidas não podem ser renomeadas — só desativadas.");
  }

  return repos.categoriaRepo.update(id, validados as Partial<CategoriaLancamento>);
}
