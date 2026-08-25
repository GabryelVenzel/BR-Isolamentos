import { NotFoundError } from "../../errors";
import type { HistoricoServicoRepository, ServicoRepository } from "../../repositories";
import type { HistoricoServico, Servico } from "../../types/domain";
import { RemoverArquivoServicoSchema, parseOrThrow } from "../../validators";

const DESCRICAO_CAMPO: Record<string, string> = {
  foto_principal_url: "Foto principal removida.",
  pdf_relatorio_url: "PDF relatório removido.",
  fotos_url: "Foto adicional removida.",
};

/** Contraparte de anexarArquivoServico.ts — remove a URL do serviço
 * (`fotos_url` filtra o item específico; os outros dois campos viram null).
 * O arquivo em si no Supabase Storage é removido pelo chamador
 * (ServicoDetailModal.tsx, direto no navegador, mesmo padrão de upload) —
 * este use case só desassocia a URL do serviço. */
export async function removerArquivoServico(
  servicoId: string,
  input: unknown,
  repos: { servicoRepo: ServicoRepository; historicoRepo: HistoricoServicoRepository },
  usuarioEmail?: string | null
): Promise<Servico> {
  const { campo, url } = parseOrThrow(RemoverArquivoServicoSchema, input);

  const servico = await repos.servicoRepo.findById(servicoId);
  if (!servico) throw new NotFoundError(`Serviço ${servicoId} não encontrado.`);

  const patch: Partial<Servico> =
    campo === "fotos_url" ? { fotos_url: servico.fotos_url.filter((f) => f !== url) } : { [campo]: null };

  const atualizado = await repos.servicoRepo.update(servicoId, patch);

  // tipo_evento continua "anexo_adicionado" — o check constraint de
  // historico_servicos (migração 008) não tem um valor "anexo_removido"
  // próprio, e criar um exigiria mais uma migração só pra isso; a
  // `descricao` ("... removida/removido") já deixa claro pra quem lê a
  // timeline que foi uma remoção, não um novo anexo.
  await repos.historicoRepo.create({
    servico_id: servicoId,
    tipo_evento: "anexo_adicionado",
    descricao: DESCRICAO_CAMPO[campo] ?? "Arquivo removido.",
    usuario_email: usuarioEmail ?? null,
  } as Partial<HistoricoServico>);

  return atualizado;
}
