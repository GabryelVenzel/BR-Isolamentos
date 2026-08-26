import { NotFoundError, ValidationError } from "../../errors";
import type { HistoricoServicoRepository, ServicoRepository } from "../../repositories";
import type { HistoricoServico, Servico } from "../../types/domain";
import { AnexarArquivoServicoSchema, parseOrThrow } from "../../validators";

// Limite de fotos do projeto (modelo unificado — ver sql-migration-013,
// decisão 5). Checado aqui também (não só no botão de upload do frontend)
// porque o upload em si já foi feito no Storage antes desta chamada — sem
// essa checagem, um upload concorrente ou uma chamada direta à API poderia
// passar do limite.
const LIMITE_FOTOS_SERVICO = 20;

const DESCRICAO_CAMPO: Record<string, string> = {
  foto_principal_url: "Foto principal anexada.",
  pdf_relatorio_url: "PDF relatório anexado.",
  fotos_url: "Foto do projeto anexada.",
};

/** Registra a URL de um arquivo já enviado ao Supabase Storage (o upload em
 * si acontece no navegador, direto pro bucket `servicos-anexos` — mesmo
 * padrão de components/GaleriaImagensProposta.tsx; este use case só grava a
 * URL resultante no serviço). `fotos_url` é um array — a nova URL é
 * adicionada, não substitui as anteriores; os outros dois campos são
 * substituídos (só um PDF relatório por vez; `foto_principal_url` não é mais
 * escrito pela UI, ver ServicoDetailModal.tsx). */
export async function anexarArquivoServico(
  servicoId: string,
  input: unknown,
  repos: { servicoRepo: ServicoRepository; historicoRepo: HistoricoServicoRepository },
  usuarioEmail?: string | null
): Promise<Servico> {
  const { campo, url } = parseOrThrow(AnexarArquivoServicoSchema, input);

  const servico = await repos.servicoRepo.findById(servicoId);
  if (!servico) throw new NotFoundError(`Serviço ${servicoId} não encontrado.`);

  if (campo === "fotos_url" && servico.fotos_url.length >= LIMITE_FOTOS_SERVICO) {
    throw new ValidationError(`Limite de ${LIMITE_FOTOS_SERVICO} fotos por serviço atingido.`);
  }

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
