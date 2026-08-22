import { NotFoundError } from "../../errors";
import type { InteracaoLeadRepository, LeadRepository } from "../../repositories";
import type { InteracaoLead } from "../../types/domain";
import { CreateInteracaoLeadSchema, parseOrThrow } from "../../validators";

export async function registrarInteracao(
  input: unknown,
  repos: { leadRepo: LeadRepository; interacaoRepo: InteracaoLeadRepository }
): Promise<InteracaoLead> {
  const dados = parseOrThrow(CreateInteracaoLeadSchema, input);

  const lead = await repos.leadRepo.findById(dados.lead_id);
  if (!lead) throw new NotFoundError(`Lead ${dados.lead_id} não encontrado.`);

  return repos.interacaoRepo.create(dados as Partial<InteracaoLead>);
}
