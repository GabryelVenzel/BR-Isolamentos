import { NotFoundError } from "../../errors";
import type { DocumentoEmpresaRepository } from "../../repositories";
import type { DocumentoEmpresa } from "../../types/domain";
import { UpdateDocumentoEmpresaSchema, parseOrThrow } from "../../validators";

/** Edita nome, validade, categoria e tipo de um documento da empresa — o
 * arquivo em si se troca por "Renovar" (nova versão, a anterior vira
 * histórico) ou excluindo e reanexando. */
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
