import { ConflictError, NotFoundError } from "../../errors";
import type { LeadRepository } from "../../repositories";
import type { EtapaFunil, Lead } from "../../types/domain";
import { MoverLeadSchema, parseOrThrow } from "../../validators";

/** Transições de etapa permitidas no funil comercial:
 * prospecção → contato → proposta → negociação → fechado. "perdido" é
 * terminal (igual "fechado") e alcançável a partir de qualquer etapa ativa —
 * desistência do cliente não segue uma ordem fixa. Etapas terminais não têm
 * saída: um lead "fechado" ou "perdido" não volta a se mover (reabrir é criar
 * um lead novo). */
export const TRANSICOES_FUNIL: Record<EtapaFunil, EtapaFunil[]> = {
  prospeccao: ["contato", "perdido"],
  contato: ["prospeccao", "proposta", "perdido"],
  proposta: ["contato", "negociacao", "perdido"],
  negociacao: ["proposta", "fechado", "perdido"],
  fechado: [],
  perdido: [],
};

export interface MoverLeadInput {
  leadId: string;
  novaEtapa: EtapaFunil;
}

export async function moverLead(input: unknown, repos: { leadRepo: LeadRepository }): Promise<Lead> {
  const { leadId, novaEtapa } = parseOrThrow(MoverLeadSchema, input);

  const lead = await repos.leadRepo.findById(leadId);
  if (!lead) throw new NotFoundError(`Lead ${leadId} não encontrado.`);

  if (lead.etapa === novaEtapa) return lead;

  const permitido = TRANSICOES_FUNIL[lead.etapa].includes(novaEtapa);
  if (!permitido) {
    throw new ConflictError(
      `Não é possível mover o lead de "${lead.etapa}" para "${novaEtapa}". Transições permitidas a partir de "${lead.etapa}": ${
        TRANSICOES_FUNIL[lead.etapa].join(", ") || "nenhuma (etapa terminal)"
      }.`
    );
  }

  return repos.leadRepo.update(leadId, { etapa: novaEtapa });
}
