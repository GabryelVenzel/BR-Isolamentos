import { ConflictError, NotFoundError } from "../../errors";
import type { HistoricoServicoRepository, ServicoRepository } from "../../repositories";
import type { HistoricoServico, Servico } from "../../types/domain";
import { MoverServicoSchema, parseOrThrow } from "../../validators";

/** Move um serviço entre Planejamento ⇄ Execução — livre nos dois sentidos
 * (o mesmo espírito de "qualquer transição" do módulo Comercial). Mover pra
 * "Finalizado" SEMPRE passa por `finalizarServico` (checklist de foto + PDF
 * + valor real), nunca por aqui — arrastar o card pra essa coluna no Kanban
 * deve abrir o checklist, não chamar este use case direto (ver
 * KanbanServicos.tsx). */
export async function moverServico(
  input: unknown,
  repos: { servicoRepo: ServicoRepository; historicoRepo: HistoricoServicoRepository },
  usuarioEmail?: string | null
): Promise<Servico> {
  const { servicoId, novaEtapa } = parseOrThrow(MoverServicoSchema, input);

  const servico = await repos.servicoRepo.findById(servicoId);
  if (!servico) throw new NotFoundError(`Serviço ${servicoId} não encontrado.`);

  if (novaEtapa === "finalizado") {
    throw new ConflictError(
      "Finalizar um serviço exige o checklist de documentação (foto principal, PDF relatório e valor real) — use a ação \"Confirmar finalização\", não mover direto no Kanban."
    );
  }
  if (servico.etapa === "finalizado") {
    throw new ConflictError("Este serviço já foi finalizado e não pode ser reaberto.");
  }
  if (servico.etapa === novaEtapa) return servico;

  const atualizado = await repos.servicoRepo.update(servicoId, { etapa: novaEtapa } as Partial<Servico>);

  await repos.historicoRepo.create({
    servico_id: servicoId,
    tipo_evento: "mudanca_etapa",
    etapa_anterior: servico.etapa,
    etapa_nova: novaEtapa,
    usuario_email: usuarioEmail ?? null,
  } as Partial<HistoricoServico>);

  return atualizado;
}
