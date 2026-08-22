import { NotFoundError } from "../../errors";
import type { HistoricoMudancaLeadRepository, LeadRepository } from "../../repositories";
import type { EtapaFunil, HistoricoMudancaLead, Lead } from "../../types/domain";
import { MoverLeadSchema, parseOrThrow } from "../../validators";

export interface MoverLeadInput {
  leadId: string;
  novaEtapa: EtapaFunil;
}

/** Move um lead para qualquer etapa do funil — decisão explícita do CRM:
 * QUALQUER transição é permitida (inclusive "retroceder", ou sair de uma
 * etapa terminal como "fechado"/"perdido"), porque quem opera o funil
 * conhece o negócio melhor que uma máquina de estados fixa. Isso substitui a
 * versão anterior deste use case, que restringia a transições numa ordem
 * fixa via `TRANSICOES_FUNIL` — removido de propósito, não é um descuido.
 *
 * Toda mudança de etapa grava uma entrada em `historico_mudancas_leads`
 * (a timeline "Caminho do lead" do LeadDetailModal) e atualiza
 * `leads.etapa_anterior`, para o card/modal saberem "de onde" o lead veio
 * sem precisar de outro join. */
export async function moverLead(
  input: unknown,
  repos: { leadRepo: LeadRepository; historicoRepo: HistoricoMudancaLeadRepository },
  usuarioEmail?: string | null
): Promise<Lead> {
  const { leadId, novaEtapa } = parseOrThrow(MoverLeadSchema, input);

  const lead = await repos.leadRepo.findById(leadId);
  if (!lead) throw new NotFoundError(`Lead ${leadId} não encontrado.`);

  if (lead.etapa === novaEtapa) return lead;

  const atualizado = await repos.leadRepo.update(leadId, {
    etapa: novaEtapa,
    etapa_anterior: lead.etapa,
  } as Partial<Lead>);

  await repos.historicoRepo.create({
    lead_id: leadId,
    tipo_mudanca: "mudanca_etapa",
    etapa_anterior: lead.etapa,
    etapa_nova: novaEtapa,
    usuario_email: usuarioEmail ?? null,
  } as Partial<HistoricoMudancaLead>);

  return atualizado;
}
