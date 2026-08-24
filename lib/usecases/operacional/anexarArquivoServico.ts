import { NotFoundError } from "../../errors";
import type { HistoricoServicoRepository, ServicoRepository } from "../../repositories";
import type { HistoricoServico, Servico } from "../../types/domain";
import { AnexarArquivoServicoSchema, parseOrThrow } from "../../validators";

const DESCRICAO_CAMPO: Record<string, string> = {
  foto_principal_url: "Foto principal anexada.",
  pdf_relatorio_url: "PDF relatório anexado.",
  fotos_url: "Foto adicional anexada.",
};

/** Registra a URL de um arquivo já enviado ao Supabase Storage (o upload em
 * si acontece no navegador, direto pro bucket `servicos-anexos` — mesmo
 * padrão de components/GaleriaImagensProposta.tsx; este use case só grava a
 * URL resultante no serviço). `fotos_url` é um array — a nova URL é
 * adicionada, não substitui as anteriores; os outros dois campos são
 * substituídos (só uma foto principal / um PDF relatório por vez). */
export async function anexarArquivoServico(
  servicoId: string,
  input: unknown,
  repos: { servicoRepo: ServicoRepository; historicoRepo: HistoricoServicoRepository },
  usuarioEmail?: string | null
): Promise<Servico> {
  const { campo, url } = parseOrThrow(AnexarArquivoServicoSchema, input);

  const servico = await repos.servicoRepo.findById(servicoId);
  if (!servico) throw new NotFoundError(`Serviço ${servicoId} não encontrado.`);

  const patch: Partial<Servico> =
    campo === "fotos_url" ? { fotos_url: [...servico.fotos_url, url] } : { [campo]: url };

  const atualizado = await repos.servicoRepo.update(servicoId, patch);

  await repos.historicoRepo.create({
    servico_id: servicoId,
    tipo_evento: "anexo_adicionado",
    descricao: DESCRICAO_CAMPO[campo] ?? "Arquivo anexado.",
    usuario_email: usuarioEmail ?? null,
  } as Partial<HistoricoServico>);

  return atualizado;
}
