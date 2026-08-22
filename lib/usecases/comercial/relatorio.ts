import type { AgendamentoLeadFrio, EtapaFunil, HistoricoMudancaLead, Lead } from "../../types/domain";

// Relatório da aba "Relatórios" do CRM — todas as funções aqui são PURAS
// (recebem os dados já carregados, não fazem I/O), pra serem fáceis de
// testar sem mockar Supabase. O contexto (lib/contexts/comercial.ts) busca
// os dados e chama `gerarRelatorioComercial`.
//
// Convenção do funil (igual lib/usecases/resumo/funilLeads.ts, mantida
// consistente de propósito — ver comentário lá): "perdido" fica de fora da
// contagem de progressão, é tratado como saída do funil, não uma etapa.
// Diferente do funil do dashboard Resumo (que é um snapshot da etapa ATUAL
// via a view v_leads_por_etapa), aqui a contagem é CUMULATIVA — "quantos
// leads já passaram por essa etapa alguma vez", reconstruído a partir de
// `historico_mudancas_leads` — porque este relatório precisa respeitar
// filtros (responsável, temperatura, período) que a view agregada não
// suporta, e a métrica cumulativa é mais correta para "taxa de conversão"
// de qualquer forma (um lead que já passou de Proposta pra Negociação não
// deveria "sumir" da contagem de Proposta).

const ETAPAS_PROGRESSAO: EtapaFunil[] = ["prospeccao", "contato", "proposta", "negociacao", "fechado"];
const LABELS_ETAPA: Record<EtapaFunil, string> = {
  prospeccao: "Prospecção",
  contato: "Contato",
  proposta: "Proposta",
  negociacao: "Negociação",
  fechado: "Fechado",
  perdido: "Perdido",
};

const UM_DIA_MS = 24 * 60 * 60 * 1000;

export interface KpisComercial {
  totalLeads: number;
  taxaConversaoPercentual: number;
  valorEmPipeline: number;
  ticketMedio: number;
}

/** KPIs do topo da aba Relatórios. `taxaConversaoPercentual` é sobre o TOTAL
 * de leads do conjunto filtrado (não só sobre os encerrados) — responde
 * "de todo lead que entra, quantos viram venda", que é a pergunta que
 * importa pro sócio, não "dos que já terminaram, quantos fecharam". */
export function calcularKpis(leads: Lead[]): KpisComercial {
  const totalLeads = leads.length;
  const fechados = leads.filter((l) => l.etapa === "fechado");
  const ativos = leads.filter((l) => l.etapa !== "fechado" && l.etapa !== "perdido");

  const valorEmPipeline = ativos.reduce((soma, l) => soma + l.valor_estimado, 0);
  const valorFechado = fechados.reduce((soma, l) => soma + l.valor_estimado, 0);

  return {
    totalLeads,
    taxaConversaoPercentual: totalLeads > 0 ? (fechados.length / totalLeads) * 100 : 0,
    valorEmPipeline,
    ticketMedio: fechados.length > 0 ? valorFechado / fechados.length : 0,
  };
}

export interface EtapaFunilRelatorio {
  etapa: EtapaFunil;
  label: string;
  quantidade: number;
  retencaoPercentual: number | null;
}

export interface FunilComercial {
  etapas: EtapaFunilRelatorio[];
  gargalo: { deEtapa: string; paraEtapa: string; quedaPercentual: number } | null;
}

/** Reconstrói, por lead, o conjunto de etapas por onde ele já passou (a
 * etapa atual + toda `etapa_anterior`/`etapa_nova` do seu histórico de
 * mudanças) — é o que torna a contagem "cumulativa" em vez de um snapshot da
 * etapa atual. */
function etapasVisitadasPorLead(leads: Lead[], historico: HistoricoMudancaLead[]): Map<string, Set<EtapaFunil>> {
  const porLead = new Map<string, Set<EtapaFunil>>();
  for (const lead of leads) porLead.set(lead.id, new Set([lead.etapa]));

  for (const h of historico) {
    const visitadas = porLead.get(h.lead_id);
    if (!visitadas) continue; // histórico de um lead fora do conjunto filtrado
    if (h.etapa_anterior) visitadas.add(h.etapa_anterior);
    if (h.etapa_nova) visitadas.add(h.etapa_nova);
  }

  return porLead;
}

export function calcularFunil(leads: Lead[], historico: HistoricoMudancaLead[]): FunilComercial {
  const visitadasPorLead = etapasVisitadasPorLead(leads, historico);

  const etapas: EtapaFunilRelatorio[] = ETAPAS_PROGRESSAO.map((etapa, index) => {
    let quantidade = 0;
    for (const visitadas of visitadasPorLead.values()) {
      if (visitadas.has(etapa)) quantidade++;
    }

    let retencaoPercentual: number | null = null;
    if (index > 0) {
      const etapaAnterior = ETAPAS_PROGRESSAO[index - 1];
      let anteriorQtd = 0;
      for (const visitadas of visitadasPorLead.values()) {
        if (visitadas.has(etapaAnterior)) anteriorQtd++;
      }
      retencaoPercentual = anteriorQtd > 0 ? (quantidade / anteriorQtd) * 100 : 0;
    }

    return { etapa, label: LABELS_ETAPA[etapa], quantidade, retencaoPercentual };
  });

  let gargalo: FunilComercial["gargalo"] = null;
  for (let i = 1; i < etapas.length; i++) {
    const anterior = etapas[i - 1];
    const atual = etapas[i];
    if (anterior.quantidade === 0 || atual.retencaoPercentual === null) continue;

    const queda = 100 - atual.retencaoPercentual;
    if (!gargalo || queda > gargalo.quedaPercentual) {
      gargalo = { deEtapa: anterior.label, paraEtapa: atual.label, quedaPercentual: queda };
    }
  }

  return { etapas, gargalo };
}

export interface TempoMedioEtapa {
  etapa: EtapaFunil;
  label: string;
  diasMedio: number;
}

/** Tempo médio de permanência em cada etapa, em dias — reconstruído a partir
 * da sequência ordenada de mudanças de cada lead. Cada "segmento" é o tempo
 * entre entrar numa etapa e sair dela (ou "agora", se o lead ainda está
 * nela). Leads sem nenhum histórico registrado (criados antes desta
 * funcionalidade existir) contam como um único segmento na etapa atual,
 * desde `created_at`. */
export function calcularTempoMedioPorEtapa(
  leads: Lead[],
  historico: HistoricoMudancaLead[],
  agora: Date = new Date()
): TempoMedioEtapa[] {
  const historicoPorLead = new Map<string, HistoricoMudancaLead[]>();
  for (const h of historico) {
    if (!h.etapa_nova) continue;
    const lista = historicoPorLead.get(h.lead_id) ?? [];
    lista.push(h);
    historicoPorLead.set(h.lead_id, lista);
  }

  const duracoesPorEtapa: Record<EtapaFunil, number[]> = {
    prospeccao: [],
    contato: [],
    proposta: [],
    negociacao: [],
    fechado: [],
    perdido: [],
  };

  for (const lead of leads) {
    const eventos = (historicoPorLead.get(lead.id) ?? []).slice().sort(
      (a, b) => new Date(a.data_mudanca).getTime() - new Date(b.data_mudanca).getTime()
    );

    const segmentos: Array<{ etapa: EtapaFunil; desde: Date }> =
      eventos.length > 0
        ? eventos.map((e) => ({ etapa: e.etapa_nova as EtapaFunil, desde: new Date(e.data_mudanca) }))
        : [{ etapa: lead.etapa, desde: new Date(lead.created_at) }];

    for (let i = 0; i < segmentos.length; i++) {
      const inicio = segmentos[i].desde;
      const fim = i + 1 < segmentos.length ? segmentos[i + 1].desde : agora;
      const dias = (fim.getTime() - inicio.getTime()) / UM_DIA_MS;
      if (dias >= 0) duracoesPorEtapa[segmentos[i].etapa].push(dias);
    }
  }

  return ETAPAS_PROGRESSAO.map((etapa) => {
    const duracoes = duracoesPorEtapa[etapa];
    const diasMedio = duracoes.length > 0 ? duracoes.reduce((a, b) => a + b, 0) / duracoes.length : 0;
    return { etapa, label: LABELS_ETAPA[etapa], diasMedio };
  });
}

export interface LeadsPorOrigem {
  origem: string;
  quantidade: number;
  percentual: number;
}

export function calcularLeadsPorOrigem(leads: Lead[]): LeadsPorOrigem[] {
  const total = leads.length;
  const contagem = new Map<string, number>();
  for (const lead of leads) {
    const origem = lead.origem?.trim() || "Não informado";
    contagem.set(origem, (contagem.get(origem) ?? 0) + 1);
  }

  return Array.from(contagem.entries())
    .map(([origem, quantidade]) => ({ origem, quantidade, percentual: total > 0 ? (quantidade / total) * 100 : 0 }))
    .sort((a, b) => b.quantidade - a.quantidade);
}

export interface PerformanceResponsavel {
  atribuidoA: string;
  totalLeads: number;
  fechados: number;
  taxaFechamentoPercentual: number;
}

export function calcularPerformancePorResponsavel(leads: Lead[]): PerformanceResponsavel[] {
  const porResponsavel = new Map<string, Lead[]>();
  for (const lead of leads) {
    const responsavel = lead.atribuido_a ?? "Não atribuído";
    const lista = porResponsavel.get(responsavel) ?? [];
    lista.push(lead);
    porResponsavel.set(responsavel, lista);
  }

  return Array.from(porResponsavel.entries())
    .map(([atribuidoA, leadsDoResponsavel]) => {
      const fechados = leadsDoResponsavel.filter((l) => l.etapa === "fechado").length;
      return {
        atribuidoA,
        totalLeads: leadsDoResponsavel.length,
        fechados,
        taxaFechamentoPercentual: leadsDoResponsavel.length > 0 ? (fechados / leadsDoResponsavel.length) * 100 : 0,
      };
    })
    .sort((a, b) => b.totalLeads - a.totalLeads);
}

/** Leads ativos (não fechados/perdidos) sem nenhuma interação registrada há
 * 7+ dias — usa `data_ultima_interacao` se houver, senão `created_at` (lead
 * nunca contatado desde que entrou). Ordenado do mais "esquecido" pro menos. */
export function calcularLeadsDormindo(leads: Lead[], agora: Date = new Date()): Lead[] {
  const seteDiasAtras = agora.getTime() - 7 * UM_DIA_MS;

  return leads
    .filter((l) => l.etapa !== "fechado" && l.etapa !== "perdido")
    .filter((l) => {
      const referencia = l.data_ultima_interacao ?? l.created_at;
      return new Date(referencia).getTime() < seteDiasAtras;
    })
    .sort((a, b) => {
      const refA = new Date(a.data_ultima_interacao ?? a.created_at).getTime();
      const refB = new Date(b.data_ultima_interacao ?? b.created_at).getTime();
      return refA - refB;
    });
}

export interface LeadsFriosResumo {
  total: number;
  reativandoHoje: number;
  proximos7Dias: number;
  proximos30Dias: number;
}

/** Resumo do pipeline de reativação de leads frios (card "Status de leads
 * frios agendados" do relatório). Só considera agendamentos com status
 * "agendado" (os já reativados/cancelados não fazem parte da pipeline
 * futura). Os três baldes (hoje / próximos 7 / próximos 30) são mutuamente
 * exclusivos e somam o total. */
export function calcularLeadsFriosResumo(agendamentos: AgendamentoLeadFrio[], agora: Date = new Date()): LeadsFriosResumo {
  const agendados = agendamentos.filter((a) => a.status === "agendado");

  const fimDeHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 23, 59, 59, 999).getTime();
  const seteDiasFrente = agora.getTime() + 7 * UM_DIA_MS;
  const trintaDiasFrente = agora.getTime() + 30 * UM_DIA_MS;

  let reativandoHoje = 0;
  let proximos7Dias = 0;
  let proximos30Dias = 0;

  for (const agendamento of agendados) {
    const retorno = new Date(agendamento.data_retorno).getTime();
    if (retorno <= fimDeHoje) reativandoHoje++;
    else if (retorno <= seteDiasFrente) proximos7Dias++;
    else if (retorno <= trintaDiasFrente) proximos30Dias++;
  }

  return { total: agendados.length, reativandoHoje, proximos7Dias, proximos30Dias };
}

export interface RelatorioComercial {
  kpis: KpisComercial;
  funil: FunilComercial;
  tempoMedioPorEtapa: TempoMedioEtapa[];
  leadsPorOrigem: LeadsPorOrigem[];
  performancePorResponsavel: PerformanceResponsavel[];
  leadsDormindo: Lead[];
  leadsFriosResumo: LeadsFriosResumo;
}

/** Monta o relatório completo — `leads` e `historico` já devem vir
 * filtrados (período/responsável/temperatura) pelo chamador; `agendamentos`
 * não é afetado pelos mesmos filtros (é sempre a pipeline de reativação
 * inteira, ver LeadsFriosPanel.tsx). */
export function gerarRelatorioComercial(
  leads: Lead[],
  historico: HistoricoMudancaLead[],
  agendamentosFrios: AgendamentoLeadFrio[],
  agora: Date = new Date()
): RelatorioComercial {
  return {
    kpis: calcularKpis(leads),
    funil: calcularFunil(leads, historico),
    tempoMedioPorEtapa: calcularTempoMedioPorEtapa(leads, historico, agora),
    leadsPorOrigem: calcularLeadsPorOrigem(leads),
    performancePorResponsavel: calcularPerformancePorResponsavel(leads),
    leadsDormindo: calcularLeadsDormindo(leads, agora),
    leadsFriosResumo: calcularLeadsFriosResumo(agendamentosFrios, agora),
  };
}
