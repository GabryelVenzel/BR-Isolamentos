import { ConflictError, NotFoundError } from "../../errors";
import type { AgendamentoLeadFrioRepository, HistoricoMudancaLeadRepository, LeadRepository } from "../../repositories";
import type { HistoricoMudancaLead, Lead } from "../../types/domain";

/** Reativa um lead frio: volta a temperatura para "Morno" e a etapa para
 * "Contato" (qualquer que fosse a etapa em que congelou — regra do pedido:
 * "Muda etapa para Contato", não "volta para a etapa anterior"). Chamado
 * tanto pelo botão manual "Reativar agora" (`manual = true`) quanto pelo
 * sweep sob demanda que reativa agendamentos vencidos (`manual = false`, ver
 * verificarReativacoesPendentes.ts) — o único efeito colateral diferente
 * entre os dois é qual `tipo_mudanca` fica registrado no histórico. */
export async function reativarLeadFrio(
  agendamentoId: string,
  repos: {
    leadRepo: LeadRepository;
    historicoRepo: HistoricoMudancaLeadRepository;
    agendamentoFrioRepo: AgendamentoLeadFrioRepository;
  },
  usuarioEmail: string | null,
  manual: boolean
): Promise<Lead> {
  const agendamento = await repos.agendamentoFrioRepo.findById(agendamentoId);
  if (!agendamento) throw new NotFoundError(`Agendamento ${agendamentoId} não encontrado.`);
  if (agendamento.status !== "agendado") {
    throw new ConflictError(`Agendamento já está "${agendamento.status}" — não pode ser reativado de novo.`);
  }

  const lead = await repos.leadRepo.findById(agendamento.lead_id);
  if (!lead) throw new NotFoundError(`Lead ${agendamento.lead_id} não encontrado.`);

  const etapaAnterior = lead.etapa;
  const temperaturaAnterior = lead.temperatura;

  const leadAtualizado = await repos.leadRepo.update(lead.id, {
    temperatura: "morno",
    temperatura_anterior: temperaturaAnterior,
    etapa: "contato",
    etapa_anterior: etapaAnterior,
  } as Partial<Lead>);

  await repos.agendamentoFrioRepo.marcarReativado(agendamentoId);

  await repos.historicoRepo.create({
    lead_id: lead.id,
    tipo_mudanca: manual ? "reativacao_manual" : "reativacao_automatica",
    etapa_anterior: etapaAnterior,
    etapa_nova: "contato",
    temperatura_anterior: temperaturaAnterior,
    temperatura_nova: "morno",
    usuario_email: usuarioEmail,
  } as Partial<HistoricoMudancaLead>);

  return leadAtualizado;
}
