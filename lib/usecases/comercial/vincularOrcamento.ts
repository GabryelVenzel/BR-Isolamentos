import { ConflictError, NotFoundError } from "../../errors";
import { orcamentosDoLead, podeRemoverVinculo } from "../../leads";
import type { HistoricoMudancaLeadRepository, LeadOrcamentoRepository, LeadRepository, OrcamentoRepository } from "../../repositories";
import type { HistoricoMudancaLead, Lead } from "../../types/domain";
import { VincularOrcamentoSchema, parseOrThrow } from "../../validators";

interface Repos {
  leadRepo: LeadRepository;
  orcamentoRepo: OrcamentoRepository;
  historicoRepo: HistoricoMudancaLeadRepository;
  leadOrcamentoRepo: LeadOrcamentoRepository;
}

/** Vincula MAIS UM orçamento ao lead (migração 053 — um lead pode ter
 * vários: revisões, alternativas, escopos separados). Ter ao menos um é
 * pré-requisito pra mover o lead pra "negociação" (ver moverLead.ts).
 * `valor_estimado` do lead NÃO é alterado aqui — estimativa e orçamento são
 * propositalmente independentes (pedido explícito, ver histórico).
 *
 * Lead fechado não recebe orçamento novo: o fechamento já escolheu o(s)
 * vencedor(es) — para mudar, reabra o lead. */
export async function vincularOrcamento(input: unknown, repos: Repos, usuarioEmail?: string | null): Promise<Lead> {
  const { leadId, orcamentoId } = parseOrThrow(VincularOrcamentoSchema, input);

  const lead = await repos.leadRepo.findById(leadId);
  if (!lead) throw new NotFoundError(`Lead ${leadId} não encontrado.`);
  if (lead.etapa === "fechado") throw new ConflictError("Lead fechado — volte para Negociação para vincular outro orçamento.");
  if (orcamentosDoLead(lead).some((v) => v.orcamento_id === orcamentoId)) return lead;

  const orcamento = await repos.orcamentoRepo.findById(orcamentoId);
  if (!orcamento) throw new NotFoundError(`Orçamento ${orcamentoId} não encontrado.`);

  await repos.leadOrcamentoRepo.vincular(leadId, orcamentoId);

  // Status do orçamento é computado a partir do lead vinculado — "Enviado"
  // no momento em que entra em jogo numa negociação (ver moverLead.ts para
  // os status seguintes: aceito/rejeitado).
  await repos.orcamentoRepo.update(orcamentoId, { status: "enviado" });

  await repos.historicoRepo.create({
    lead_id: leadId,
    tipo_mudanca: "vinculo_orcamento",
    descricao: `Orçamento ${orcamento.numero_orcamento ?? orcamento.numero} vinculado.`,
    usuario_email: usuarioEmail ?? null,
  } as Partial<HistoricoMudancaLead>);

  return (await repos.leadRepo.findById(leadId)) ?? lead;
}

/** Remove um orçamento do lead (migração 053). Só até a etapa Proposta:
 * depois disso o orçamento está em negociação — o caminho é voltar o lead
 * para Proposta, remover, vincular o novo e avançar de novo. O orçamento
 * removido volta ao status "proposta" (deixou de estar enviado/em jogo). */
export async function desvincularOrcamento(input: unknown, repos: Repos, usuarioEmail?: string | null): Promise<Lead> {
  const { leadId, orcamentoId } = parseOrThrow(VincularOrcamentoSchema, input);

  const lead = await repos.leadRepo.findById(leadId);
  if (!lead) throw new NotFoundError(`Lead ${leadId} não encontrado.`);
  if (!podeRemoverVinculo(lead)) {
    throw new ConflictError("Para remover um orçamento, volte o lead para a etapa Proposta; depois vincule o novo e avance de novo.");
  }
  const vinculo = (lead.vinculos ?? []).find((v) => v.orcamento_id === orcamentoId);
  if (!vinculo) return lead;

  await repos.leadOrcamentoRepo.desvincular(leadId, orcamentoId);
  if (vinculo.orcamento && !vinculo.orcamento.excluido_em) await repos.orcamentoRepo.update(orcamentoId, { status: "proposta" });

  await repos.historicoRepo.create({
    lead_id: leadId,
    tipo_mudanca: "vinculo_orcamento",
    descricao: `Orçamento ${vinculo.orcamento?.numero_orcamento ?? vinculo.orcamento?.numero ?? `#${orcamentoId}`} removido.`,
    usuario_email: usuarioEmail ?? null,
  } as Partial<HistoricoMudancaLead>);

  return (await repos.leadRepo.findById(leadId)) ?? lead;
}
