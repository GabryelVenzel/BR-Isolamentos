import { NotFoundError } from "../../errors";
import type { HistoricoMudancaLeadRepository, LeadRepository, OrcamentoRepository } from "../../repositories";
import type { HistoricoMudancaLead, Lead } from "../../types/domain";
import { VincularOrcamentoSchema, parseOrThrow } from "../../validators";

/** Vincula um orçamento a um lead — pré-requisito pra mover o lead pra etapa
 * "negociação" (ver moverLead.ts). `valor_estimado` do lead NÃO é mais
 * alterado aqui — decisão revertida por pedido explícito: `valor_estimado`
 * (estimativa inicial, editável só em Dados do Lead) e `orcamento.valor_final`
 * (valor formal do orçamento vinculado, já visível separadamente na aba
 * Dados) agora são propositalmente independentes, pra permitir comparar os
 * dois depois do projeto — a versão anterior deste código sincronizava os
 * dois automaticamente ao vincular, o que era o comportamento pedido numa
 * sessão anterior e foi agora explicitamente invertido. */
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
