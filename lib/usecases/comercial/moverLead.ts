import { ConflictError, NotFoundError } from "../../errors";
import { logger } from "../../logger";
import type { AnexoLeadRepository, HistoricoMudancaLeadRepository, LancamentoFinanceiroRepository, LeadRepository, OrcamentoRepository } from "../../repositories";
import type { EtapaFunil, HistoricoMudancaLead, Lead, LancamentoFinanceiro } from "../../types/domain";
import type { StatusOrcamento } from "../../types";
import { MoverLeadSchema, parseOrThrow } from "../../validators";

/** Categoria fixa do lançamento gerado ao fechar um lead de comissão — seed
 * protegido da migração 026 (ver sql-migration-026-comissao-lead.sql). Texto
 * livre, não FK (mesma convenção de `categorias_lancamentos` desde a
 * migração 009). */
const CATEGORIA_COMISSAO_RECEBIDA = "Comissão Recebida";

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
 * Lead→Orçamento→Serviço): mover pra "negociação" exige um orçamento já
 * vinculado (ver lib/usecases/comercial/vincularOrcamento.ts) — sem isso a
 * negociação ficaria sem nenhum valor/documento por trás. O bloqueio ANTES
 * era em "proposta" (Contato→Proposta) — mudou pra "negociação" (Proposta→
 * Negociação) por pedido explícito: um lead pode entrar em Proposta sem
 * ainda ter um orçamento formal (a proposta pode estar sendo elaborada),
 * mas não pode avançar pra negociar sem um orçamento de fato vinculado.
 *
 * Lead de COMISSÃO (migração 026, `lead.eh_comissao`) troca essa exigência:
 * não precisa de orçamento vinculado (não é uma venda direta da BR
 * Isolamentos), mas exige pelo menos 1 anexo (o comprovante da indicação)
 * pra entrar em "negociação" — mesma etapa de exceção, motivo diferente.
 * Além disso, mover um lead de comissão pra "fechado" gera automaticamente
 * um lançamento financeiro de receita (ver `gerarLancamentoComissao`
 * abaixo) — falha ao gerar o lançamento é só logada, nunca impede o
 * fechamento do lead (pedido explícito).
 *
 * Toda mudança de etapa grava uma entrada em `historico_mudancas_leads`
 * (a timeline "Caminho do lead" do LeadDetailModal) e atualiza
 * `leads.etapa_anterior`, para o card/modal saberem "de onde" o lead veio
 * sem precisar de outro join. */
export async function moverLead(
  input: unknown,
  repos: {
    leadRepo: LeadRepository;
    historicoRepo: HistoricoMudancaLeadRepository;
    orcamentoRepo?: OrcamentoRepository;
    anexoLeadRepo?: AnexoLeadRepository;
    lancamentoRepo?: LancamentoFinanceiroRepository;
  },
  usuarioEmail?: string | null
): Promise<Lead> {
  const { leadId, novaEtapa } = parseOrThrow(MoverLeadSchema, input);

  const lead = await repos.leadRepo.findById(leadId);
  if (!lead) throw new NotFoundError(`Lead ${leadId} não encontrado.`);

  if (lead.etapa === novaEtapa) return lead;

  if (novaEtapa === "negociacao") {
    if (lead.eh_comissao) {
      const totalAnexos = repos.anexoLeadRepo ? await repos.anexoLeadRepo.contarPorLead(leadId) : 0;
      if (totalAnexos === 0) {
        throw new ConflictError("Comissão requer pelo menos 1 anexo (comprovante). Adicione um anexo antes de avançar.");
      }
    } else if (!lead.orcamento_id) {
      throw new ConflictError("Orçamento obrigatório para iniciar negociação.");
    }
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

  if (novaEtapa === "fechado" && lead.eh_comissao && repos.lancamentoRepo) {
    await gerarLancamentoComissao(atualizado, repos.lancamentoRepo);
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

/** Gera o lançamento de receita ao fechar um lead de comissão — best-effort:
 * qualquer falha (categoria removida, erro de conexão, etc.) é só logada,
 * nunca propagada — o lead já fechou (etapa já foi salva antes desta
 * chamada), travar a resposta inteira por causa do lançamento seria pior que
 * o usuário ter que lançar manualmente depois (pedido explícito: "Mesmo
 * assim fechar o lead — não bloquear fechamento"). */
async function gerarLancamentoComissao(lead: Lead, lancamentoRepo: LancamentoFinanceiroRepository): Promise<void> {
  try {
    const nomeParceiro = lead.parceiro?.nome ?? "Parceiro";
    const nomeCliente = lead.cliente?.nome ?? "Cliente";

    await lancamentoRepo.create({
      tipo: "receita",
      categoria: CATEGORIA_COMISSAO_RECEBIDA,
      data: new Date().toISOString().slice(0, 10),
      descricao: `Comissão - ${nomeParceiro} para ${nomeCliente}`,
      valor: lead.valor_comissao ?? 0,
      pago: false,
      lead_id: lead.id,
    } as Partial<LancamentoFinanceiro>);
  } catch (error) {
    logger.error("Falha ao gerar lançamento automático de comissão", error, { leadId: lead.id });
  }
}
