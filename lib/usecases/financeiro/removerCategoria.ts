import { ConflictError, NotFoundError } from "../../errors";
import type { CategoriaLancamentoRepository } from "../../repositories";

export async function removerCategoria(
  id: string,
  repos: { categoriaRepo: CategoriaLancamentoRepository }
): Promise<void> {
  const categoria = await repos.categoriaRepo.findById(id);
  if (!categoria) throw new NotFoundError(`Categoria ${id} não encontrada.`);

  if (categoria.protegida) {
    throw new ConflictError('Categorias pré-definidas não podem ser excluídas — use "Desativar" em vez disso.');
  }

  const totalLancamentos = await repos.categoriaRepo.contarLancamentosComCategoria(categoria.nome);
  if (totalLancamentos > 0) {
    throw new ConflictError(
      `Esta categoria tem ${totalLancamentos} lançamento${totalLancamentos === 1 ? "" : "s"} — desative em vez de excluir, ou reatribua os lançamentos primeiro.`
    );
  }

  await repos.categoriaRepo.delete(id);
}
