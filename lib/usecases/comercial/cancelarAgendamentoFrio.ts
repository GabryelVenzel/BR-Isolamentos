import { ConflictError, NotFoundError } from "../../errors";
import type { AgendamentoLeadFrioRepository } from "../../repositories";
import type { AgendamentoLeadFrio } from "../../types/domain";
import { CancelarAgendamentoFrioSchema, parseOrThrow } from "../../validators";

/** Cancela um agendamento de reativação sem mudar o lead — o lead continua
 * "Frio", só deixa de ter um retorno automático programado (botão
 * "Cancelar" do painel de Leads Frios). */
export async function cancelarAgendamentoFrio(
  agendamentoId: string,
  input: unknown,
  repos: { agendamentoFrioRepo: AgendamentoLeadFrioRepository }
): Promise<AgendamentoLeadFrio> {
  const { motivoCancelamento } = parseOrThrow(CancelarAgendamentoFrioSchema, input ?? {});

  const agendamento = await repos.agendamentoFrioRepo.findById(agendamentoId);
  if (!agendamento) throw new NotFoundError(`Agendamento ${agendamentoId} não encontrado.`);
  if (agendamento.status !== "agendado") {
    throw new ConflictError(`Agendamento já está "${agendamento.status}" — não pode ser cancelado.`);
  }

  return repos.agendamentoFrioRepo.marcarCancelado(agendamentoId, motivoCancelamento ?? null);
}
