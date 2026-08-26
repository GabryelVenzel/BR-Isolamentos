import { NotFoundError } from "../../errors";
import type { FornecedorAnexoRepository, FornecedorRepository } from "../../repositories";
import type { FornecedorAnexo } from "../../types/domain";
import { CreateFornecedorAnexoSchema, parseOrThrow } from "../../validators";

/** Registra a URL de um documento já enviado ao Supabase Storage (upload em
 * si acontece no navegador, bucket "fornecedores-anexos") — mesmo padrão de
 * anexarArquivoParceiro.ts. Só disponível na tela de Editar Fornecedor. */
export async function anexarArquivoFornecedor(
  input: unknown,
  repos: { fornecedorRepo: FornecedorRepository; fornecedorAnexoRepo: FornecedorAnexoRepository }
): Promise<FornecedorAnexo> {
  const dados = parseOrThrow(CreateFornecedorAnexoSchema, input);

  const fornecedor = await repos.fornecedorRepo.findById(dados.fornecedor_id);
  if (!fornecedor) throw new NotFoundError(`Fornecedor ${dados.fornecedor_id} não encontrado.`);

  return repos.fornecedorAnexoRepo.create(dados as Partial<FornecedorAnexo>);
}
