import { NotFoundError } from "../../errors";
import type { FuncionarioAnexoRepository, FuncionarioRepository } from "../../repositories";
import type { FuncionarioAnexo } from "../../types/domain";
import { CreateFuncionarioAnexoSchema, parseOrThrow } from "../../validators";

/** Registra a URL de um documento já enviado ao Supabase Storage (upload em
 * si acontece no navegador, bucket "rh-funcionarios-anexos") — mesmo padrão
 * de anexarArquivoFornecedor.ts. Um funcionário pode ter muitos documentos
 * (pedido explícito: "podemos ter 15, 20 documentos"), sem limite de
 * categoria fixa — cada um com seu próprio nome (ASO, NR-35...). */
export async function anexarArquivoFuncionario(
  input: unknown,
  repos: { funcionarioRepo: FuncionarioRepository; funcionarioAnexoRepo: FuncionarioAnexoRepository }
): Promise<FuncionarioAnexo> {
  const dados = parseOrThrow(CreateFuncionarioAnexoSchema, input);

  const funcionario = await repos.funcionarioRepo.findById(dados.funcionario_id);
  if (!funcionario) throw new NotFoundError(`Funcionário ${dados.funcionario_id} não encontrado.`);

  return repos.funcionarioAnexoRepo.create(dados as Partial<FuncionarioAnexo>);
}
