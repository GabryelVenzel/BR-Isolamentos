import { NotFoundError } from "../../errors";
import type { HistoricoMudancaLeadRepository, LeadRepository, OrcamentoRepository } from "../../repositories";
import type { HistoricoMudancaLead, Lead } from "../../types/domain";
import { VincularOrcamentoSchema, parseOrThrow } from "../../validators";

/** Vincula um orçamento a um lead — pré-requisito pra mover o lead pra
 * etapa "proposta" (ver moverLead.ts). Ao vincular, `valor_estimado` do lead
 * passa a refletir `orcamento.valor_final` (regra do pedido: "o valor do
 * card do lead muda para o valor do orçamento"). */
export async function vincularOrcamento(
  input: unknown,
  repos: { leadRepo: LeadRepository; orcamentoRepo: OrcamentoRepository; historicoRepo: HistoricoMudancaLeadRepository },
  usuarioEmail?: string | null
): Promise<Lead> {
  const { leadId, orcamentoId } = parseOrThrow(VincularOrcamentoSchema, input);

  const lead = await repos.leadRepo.findById(leadId);
  if (!lead) throw new NotFoundError(`Lead ${leadId} não encontrado.`);

  const orcamento = await repos.orcamentoRepo.findById(orcamentoId);
  if (!orcamento) throw new NotFoundError(`Orçamento ${orcamentoId} não encontrado.`);

  const atualizado = await repos.leadRepo.update(leadId, {
    orcamento_id: orcamentoId,
    valor_estimado: orcamento.valor_final,
  } as Partial<Lead>);

  // Status do orçamento passa a ser computado a partir do lead vinculado —
  // "Enviado" no momento em que entra em jogo numa negociação (vinculado a
  // um lead), sem exigir uma troca manual de status na tela de Orçamento
  // (ver também moverLead.ts para os status seguintes: aceito/rejeitado).
  await repos.orcamentoRepo.update(orcamentoId, { status: "enviado" });

  await repos.historicoRepo.create({
    lead_id: leadId,
    tipo_mudanca: "vinculo_orcamento",
    descricao: `Orçamento ${orcamento.numero_orcamento ?? orcamento.numero} vinculado.`,
    usuario_email: usuarioEmail ?? null,
  } as Partial<HistoricoMudancaLead>);

  return atualizado;
}
