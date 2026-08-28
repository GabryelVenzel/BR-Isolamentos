import type { ConfigPrazoEtapas, EtapaFunil, HistoricoMudancaLead, Lead } from "../../types/domain";

// Cálculo de "há quantos dias o lead está na etapa atual" + se isso já
// estourou o prazo configurado (lead "atrasado") — funções puras, mesmo
// espírito de lib/usecases/comercial/relatorio.ts (fáceis de testar sem
// mockar Supabase). Usado por createComercialContext#listarLeads pra anexar
// `dias_na_etapa_atual`/`etapa_atrasada` em cada lead antes de devolver pro
// Kanban.

const UM_DIA_MS = 24 * 60 * 60 * 1000;

/** Dias desde que o lead entrou na etapa ATUAL — olha o histórico do lead
 * pela entrada mais recente com `etapa_nova` preenchido (criação, mudança de
 * etapa ou reativação); se o lead não tem nenhuma entrada (criado antes desta
 * funcionalidade existir), usa `created_at`. Mesma técnica de "segmento" de
 * calcularTempoMedioPorEtapa em relatorio.ts, mas só o ÚLTIMO segmento (o que
 * está em andamento agora), não a série inteira. */
export function calcularDiasNaEtapaAtual(lead: Lead, historico: HistoricoMudancaLead[], agora: Date = new Date()): number {
  let maisRecente: HistoricoMudancaLead | null = null;
  for (const h of historico) {
    if (h.lead_id !== lead.id || !h.etapa_nova) continue;
    if (!maisRecente || new Date(h.data_mudanca) > new Date(maisRecente.data_mudanca)) maisRecente = h;
  }

  const desde = maisRecente ? new Date(maisRecente.data_mudanca) : new Date(lead.created_at);
  return Math.max(0, (agora.getTime() - desde.getTime()) / UM_DIA_MS);
}

/** Prazo máximo configurado para `etapa`, ou `null` se a etapa é terminal
 * (fechado/perdido não têm prazo — não faz sentido "atrasar" onde o lead não
 * vai mais sair) ou se não há configuração carregada ainda (tabela
 * config_prazo_etapas criada em migração posterior — degrada sem quebrar). */
function limiteDiasPorEtapa(etapa: EtapaFunil, config: ConfigPrazoEtapas | null): number | null {
  if (!config) return null;
  switch (etapa) {
    case "prospeccao":
      return config.dias_prospeccao;
    case "contato":
      return config.dias_contato;
    case "proposta":
      return config.dias_proposta;
    case "negociacao":
      return config.dias_negociacao;
    case "fechado":
    case "perdido":
    default:
      return null;
  }
}

/** Anexa `dias_na_etapa_atual` e `etapa_atrasada` em cada lead da lista —
 * não muta os leads recebidos, devolve uma cópia. */
export function anexarPrazoEtapa(
  leads: Lead[],
  historico: HistoricoMudancaLead[],
  config: ConfigPrazoEtapas | null,
  agora: Date = new Date()
): Lead[] {
  return leads.map((lead) => {
    const dias = calcularDiasNaEtapaAtual(lead, historico, agora);
    const limite = limiteDiasPorEtapa(lead.etapa, config);
    return {
      ...lead,
      dias_na_etapa_atual: dias,
      etapa_atrasada: limite !== null && dias > limite,
    };
  });
}

/** Anexa `total_anexos` (migração 026) só nos leads de comissão — alimenta o
 * indicador visual do card do Kanban (✅ tem comprovante / ⚠️ não tem) sem
 * fazer 1 query por lead (`contagemPorLead` já vem em lote, ver
 * AnexoLeadRepository.contarPorLeads). Leads normais ficam com `total_anexos`
 * `undefined` — o indicador só faz sentido pra comissão. */
export function anexarTotalAnexos(leads: Lead[], contagemPorLead: Record<string, number>): Lead[] {
  return leads.map((lead) => (lead.eh_comissao ? { ...lead, total_anexos: contagemPorLead[lead.id] ?? 0 } : lead));
}
