import { NotFoundError } from "../../errors";
import type { DocumentoEmpresaRepository } from "../../repositories";
import type { DocumentoEmpresa } from "../../types/domain";
import { CreateDocumentoEmpresaSchema, parseOrThrow } from "../../validators";

/** Registra a URL de um documento já enviado ao Supabase Storage (upload em
 * si acontece no navegador, bucket "rh-empresa-anexos") — mesmo padrão de
 * anexarArquivoFornecedor.ts.
 *
 * RENOVAR (migração 052): com `substitui_id`, o documento novo entra no
 * mesmo grupo de versões do antigo (herdando categoria e tipo, se não vierem)
 * e o antigo é arquivado — sai da lista, mas fica no histórico. */
export async function anexarDocumentoEmpresa(
  input: unknown,
  repos: { documentoEmpresaRepo: DocumentoEmpresaRepository }
): Promise<DocumentoEmpresa> {
  const { substitui_id, ...dados } = parseOrThrow(CreateDocumentoEmpresaSchema, input);
  if (!substitui_id) return repos.documentoEmpresaRepo.create(dados as Partial<DocumentoEmpresa>);

  const anterior = await repos.documentoEmpresaRepo.findById(substitui_id);
  if (!anterior) throw new NotFoundError("Documento a renovar não encontrado.");
  const novo = await repos.documentoEmpresaRepo.create({
    ...dados,
    categoria: dados.categoria ?? anterior.categoria ?? null,
    tipo_id: dados.tipo_id ?? anterior.tipo_id ?? null,
    grupo_id: anterior.grupo_id,
  } as Partial<DocumentoEmpresa>);
  await repos.documentoEmpresaRepo.update(anterior.id, { arquivado_em: new Date().toISOString() } as Partial<DocumentoEmpresa>);
  return novo;
}
