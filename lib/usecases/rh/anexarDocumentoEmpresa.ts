import type { DocumentoEmpresaRepository } from "../../repositories";
import type { DocumentoEmpresa } from "../../types/domain";
import { CreateDocumentoEmpresaSchema, parseOrThrow } from "../../validators";

/** Registra a URL de um documento já enviado ao Supabase Storage (upload em
 * si acontece no navegador, bucket "rh-empresa-anexos") — mesmo padrão de
 * anexarArquivoFornecedor.ts. */
export async function anexarDocumentoEmpresa(
  input: unknown,
  repos: { documentoEmpresaRepo: DocumentoEmpresaRepository }
): Promise<DocumentoEmpresa> {
  const dados = parseOrThrow(CreateDocumentoEmpresaSchema, input);
  return repos.documentoEmpresaRepo.create(dados as Partial<DocumentoEmpresa>);
}
