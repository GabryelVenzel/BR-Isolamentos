import { NotFoundError } from "../../errors";
import type { AnexoLeadRepository, LeadRepository } from "../../repositories";
import type { AnexoLead } from "../../types/domain";
import { CreateAnexoLeadSchema, parseOrThrow } from "../../validators";

/** Registra a URL de um documento já enviado ao Supabase Storage (upload em
 * si acontece no navegador, bucket "leads-anexos" — mesmo padrão de
 * anexarArquivoServico.ts). Diferente dos anexos de serviço (só 3 campos
 * fixos: foto principal/fotos/PDF), um lead pode ter QUALQUER quantidade de
 * documentos de tipos variados (RG, contrato, foto, planilha...) — daí a
 * tabela própria `anexos_lead` em vez de campos fixos em `leads`. */
export async function anexarArquivoLead(
  input: unknown,
  repos: { leadRepo: LeadRepository; anexoLeadRepo: AnexoLeadRepository }
): Promise<AnexoLead> {
  const dados = parseOrThrow(CreateAnexoLeadSchema, input);

  const lead = await repos.leadRepo.findById(dados.lead_id);
  if (!lead) throw new NotFoundError(`Lead ${dados.lead_id} não encontrado.`);

  return repos.anexoLeadRepo.create(dados as Partial<AnexoLead>);
}
