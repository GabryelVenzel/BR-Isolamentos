import { NotFoundError } from "../../errors";
import type { DocumentoEmpresaRepository } from "../../repositories";
import type { DocumentoEmpresa } from "../../types/domain";
import { UpdateDocumentoEmpresaSchema, parseOrThrow } from "../../validators";

/** Renomeia um documento da empresa (pedido explícito: "gerando uma lista
 * que pode ser excluída ou editada") — só o nome muda, o arquivo em si se
 * troca excluindo e reanexando. */
export async function renomearDocumentoEmpresa(
  id: string,
  dados: unknown,
  repos: { documentoEmpresaRepo: DocumentoEmpresaRepository }
): Promise<DocumentoEmpresa> {
  const existente = await repos.documentoEmpresaRepo.findById(id);
  if (!existente) throw new NotFoundError(`Documento ${id} não encontrado.`);

  const validados = parseOrThrow(UpdateDocumentoEmpresaSchema, dados);
  return repos.documentoEmpresaRepo.update(id, validados as Partial<DocumentoEmpresa>);
}
