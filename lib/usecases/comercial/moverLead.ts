import { ConflictError, NotFoundError } from "../../errors";
import type { HistoricoMudancaLeadRepository, LeadRepository, OrcamentoRepository } from "../../repositories";
import type { EtapaFunil, HistoricoMudancaLead, Lead } from "../../types/domain";
import type { StatusOrcamento } from "../../types";
import { MoverLeadSchema, parseOrThrow } from "../../validators";

export interface MoverLeadInput {
  leadId: string;
  novaEtapa: EtapaFunil;
}

/** Status do orçamento é COMPUTADO a partir da etapa do lead vinculado, não
 * editado manualmente na tela de Orçamento — "Proposta"/"Negociação" mantêm
 * "enviado" (já setado no momento do vínculo, ver vincularOrcamento.ts);
 * "Fechado" (venda ganha) vira "aceito" — não existe um status "fechado" no
 * enum de `orcamentos`, "aceito" já é o equivalente semântico; "Perdido"
 * vira "rejeitado". Como QUALQUER transição de etapa é permitida (inclusive
 * sair de uma etapa terminal — ver comentário abaixo), mover um lead de
 * volta de "Fechado"/"Perdido" pra "Negociação" também REVERTE o orçamento
 * pra "enviado" — o status nunca fica "preso" fora de sincronia com o lead. */
const STATUS_ORCAMENTO_POR_ETAPA: Partial<Record<EtapaFunil, StatusOrcamento>> = {
  proposta: "enviado",
  negociacao: "enviado",
  fechado: "aceito",
  perdido: "rejeitado",
};

/** Move um lead para qualquer etapa do funil — decisão explícita do CRM:
 * QUALQUER transição é permitida (inclusive "retroceder", ou sair de uma
 * etapa terminal como "fechado"/"perdido"), porque quem opera o funil
 * conhece o negócio melhor que uma máquina de estados fixa. Isso substitui a
 * versão anterior deste use case, que restringia a transições numa ordem
 * fixa via `TRANSICOES_FUNIL` — removido de propósito, não é um descuido.
 *
 * ÚNICA exceção a essa regra (pedido explícito da integração
 * Lead→Orçamento→Serviço): mover pra "proposta" exige um orçamento já
 * vinculado (ver lib/usecases/comercial/vincularOrcamento.ts) — sem isso o
 * card de "Proposta" ficaria sem nenhum valor/documento por trás.
 *
 * Toda mudança de etapa grava uma entrada em `historico_mudancas_leads`
 * (a timeline "Caminho do lead" do LeadDetailModal) e atualiza
 * `leads.etapa_anterior`, para o card/modal saberem "de onde" o lead veio
 * sem precisar de outro join. */
export async function moverLead(
  input: unknown,
  repos: { leadRepo: LeadRepository; historicoRepo: HistoricoMudancaLeadRepository; orcamentoRepo?: OrcamentoRepository },
  usuarioEmail?: string | null
): Promise<Lead> {
  const { leadId, novaEtapa } = parseOrThrow(MoverLeadSchema, input);

  const lead = await repos.leadRepo.findById(leadId);
  if (!lead) throw new NotFoundError(`Lead ${leadId} não encontrado.`);

  if (lead.etapa === novaEtapa) return lead;

  if (novaEtapa === "proposta" && !lead.orcamento_id) {
    throw new ConflictError("Vincule um orçamento a este lead antes de movê-lo para Proposta.");
  }

  const atualizado = await repos.leadRepo.update(leadId, {
    etapa: novaEtapa,
    etapa_anterior: lead.etapa,
  } as Partial<Lead>);

  // `orcamentoRepo` é opcional só pra não quebrar chamadores/testes antigos
  // que não passavam esse repo — o contexto real (lib/contexts/comercial.ts)
  // sempre passa em produção.
  const novoStatusOrcamento = STATUS_ORCAMENTO_POR_ETAPA[novaEtapa];
  if (lead.orcamento_id && novoStatusOrcamento && repos.orcamentoRepo) {
    await repos.orcamentoRepo.update(lead.orcamento_id, { status: novoStatusOrcamento });
  }

  await repos.historicoRepo.create({
    lead_id: leadId,
    tipo_mudanca: "mudanca_etapa",
    etapa_anterior: lead.etapa,
    etapa_nova: novaEtapa,
    usuario_email: usuarioEmail ?? null,
  } as Partial<HistoricoMudancaLead>);

  return atualizado;
}
