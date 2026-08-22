import type { LeadRepository } from "../../repositories";
import type { Lead } from "../../types/domain";
import { CreateLeadSchema, parseOrThrow } from "../../validators";

export async function criarLead(input: unknown, repos: { leadRepo: LeadRepository }): Promise<Lead> {
  const dados = parseOrThrow(CreateLeadSchema, input);
  return repos.leadRepo.create(dados as Partial<Lead>);
}
