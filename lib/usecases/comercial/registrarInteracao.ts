import { NotFoundError } from "../../errors";
import type { InteracaoLeadRepository, LeadRepository } from "../../repositories";
import type { InteracaoLead, Lead } from "../../types/domain";
import { CreateInteracaoLeadSchema, parseOrThrow } from "../../validators";

export async function registrarInteracao(
  input: unknown,
  repos: { leadRepo: LeadRepository; interacaoRepo: InteracaoLeadRepository }
): Promise<InteracaoLead> {
  const dados = parseOrThrow(CreateInteracaoLeadSchema, input);

  const lead = await repos.leadRepo.findById(dados.lead_id);
  if (!lead) throw new NotFoundError(`Lead ${dados.lead_id} não encontrado.`);

  const interacao = await repos.interacaoRepo.create(dados as Partial<InteracaoLead>);

  // Base do relatório "leads dormindo" (sem interação há 7+ dias) — sem isso
  // a única data disponível seria `updated_at`, que muda por qualquer edição
  // do lead, não só por contato de verdade.
  await repos.leadRepo.update(dados.lead_id, {
    data_ultima_interacao: interacao.data_interacao ?? new Date().toISOString(),
  } as Partial<Lead>);

  return interacao;
}
