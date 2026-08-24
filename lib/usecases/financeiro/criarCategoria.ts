import type { CategoriaLancamentoRepository } from "../../repositories";
import type { CategoriaLancamento } from "../../types/domain";
import { CreateCategoriaLancamentoSchema, parseOrThrow } from "../../validators";

/** Categoria criada pela tela NUNCA nasce protegida — só o seed (migração
 * 009) marca `protegida = true`, e isso é fixado explicitamente aqui (não
 * confiar em nenhum default de schema pra um campo de segurança). */
export async function criarCategoria(
  input: unknown,
  repos: { categoriaRepo: CategoriaLancamentoRepository }
): Promise<CategoriaLancamento> {
  const dados = parseOrThrow(CreateCategoriaLancamentoSchema, input);
  return repos.categoriaRepo.create({ ...dados, protegida: false } as Partial<CategoriaLancamento>);
}
