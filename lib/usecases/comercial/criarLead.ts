import type { HistoricoMudancaLeadRepository, LeadRepository } from "../../repositories";
import type { HistoricoMudancaLead, Lead } from "../../types/domain";
import { CreateLeadSchema, parseOrThrow } from "../../validators";

/** Cria um lead e grava a primeira entrada da timeline ("Caminho do lead"):
 * tipo "criacao", já com a etapa/temperatura iniciais — é o topo mais antigo
 * mostrado em TimelineHistorico.tsx (ex.: "Criado em Contato · Morno"). */
export async function criarLead(
  input: unknown,
  repos: { leadRepo: LeadRepository; historicoRepo: HistoricoMudancaLeadRepository },
  usuarioEmail?: string | null
): Promise<Lead> {
  const dados = parseOrThrow(CreateLeadSchema, input);
  const lead = await repos.leadRepo.create(dados as Partial<Lead>);

  await repos.historicoRepo.create({
    lead_id: lead.id,
    tipo_mudanca: "criacao",
    etapa_nova: lead.etapa,
    temperatura_nova: lead.temperatura,
    usuario_email: usuarioEmail ?? null,
  } as Partial<HistoricoMudancaLead>);

  return lead;
}
