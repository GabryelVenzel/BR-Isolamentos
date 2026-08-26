import { NotFoundError } from "../../errors";
import type { ParceiroAnexoRepository, ParceiroRepository } from "../../repositories";
import type { ParceiroAnexo } from "../../types/domain";
import { CreateParceiroAnexoSchema, parseOrThrow } from "../../validators";

/** Registra a URL de um documento já enviado ao Supabase Storage (upload em
 * si acontece no navegador, bucket "parceiros-anexos") — mesmo padrão de
 * anexarArquivoLead.ts. Só disponível na tela de Editar Parceiro (pedido
 * explícito: não faz sentido pedir documentação antes do parceiro existir). */
export async function anexarArquivoParceiro(
  input: unknown,
  repos: { parceiroRepo: ParceiroRepository; parceiroAnexoRepo: ParceiroAnexoRepository }
): Promise<ParceiroAnexo> {
  const dados = parseOrThrow(CreateParceiroAnexoSchema, input);

  const parceiro = await repos.parceiroRepo.findById(dados.parceiro_id);
  if (!parceiro) throw new NotFoundError(`Parceiro ${dados.parceiro_id} não encontrado.`);

  return repos.parceiroAnexoRepo.create(dados as Partial<ParceiroAnexo>);
}
