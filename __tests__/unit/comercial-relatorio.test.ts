import {
  calcularFunil,
  calcularKpis,
  calcularLeadsDormindo,
  calcularLeadsFriosResumo,
  calcularLeadsPorOrigem,
  calcularPerformancePorResponsavel,
  calcularTempoMedioPorEtapa,
} from "@/lib/usecases/comercial";
import type { AgendamentoLeadFrio, HistoricoMudancaLead, Lead } from "@/lib/types/domain";

function lead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: "l1",
    numero_lead: null,
    cliente_id: 1,
    etapa: "prospeccao",
    temperatura: "morno",
    valor_estimado: 1000,
    origem: null,
    proxima_acao: null,
    data_proxima_acao: null,
    notas: null,
    atribuido_a: null,
    tags: [],
    orcamento_id: null,
    etapa_anterior: null,
    temperatura_anterior: null,
    data_ultima_interacao: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function mudancaEtapa(overrides: Partial<HistoricoMudancaLead> = {}): HistoricoMudancaLead {
  return {
    id: "h1",
    lead_id: "l1",
    tipo_mudanca: "mudanca_etapa",
    etapa_anterior: null,
    etapa_nova: null,
    temperatura_anterior: null,
    temperatura_nova: null,
    descricao: null,
    data_mudanca: "2026-01-01T00:00:00Z",
    usuario_email: null,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("calcularKpis", () => {
  it("taxa de conversão é sobre o TOTAL de leads, não só os encerrados", () => {
    const leads = [
      lead({ id: "1", etapa: "fechado", valor_estimado: 5000 }),
      lead({ id: "2", etapa: "perdido" }),
      lead({ id: "3", etapa: "contato" }),
      lead({ id: "4", etapa: "contato" }),
    ];
    const kpis = calcularKpis(leads);
    expect(kpis.totalLeads).toBe(4);
    expect(kpis.taxaConversaoPercentual).toBe(25); // 1 fechado / 4 total
  });

  it("valor em pipeline soma só leads ativos (não fechado nem perdido)", () => {
    const leads = [
      lead({ id: "1", etapa: "fechado", valor_estimado: 5000 }),
      lead({ id: "2", etapa: "contato", valor_estimado: 3000 }),
      lead({ id: "3", etapa: "negociacao", valor_estimado: 2000 }),
    ];
    expect(calcularKpis(leads).valorEmPipeline).toBe(5000);
  });

  it("ticket médio é 0 quando não há lead fechado (não NaN)", () => {
    const kpis = calcularKpis([lead({ etapa: "contato" })]);
    expect(kpis.ticketMedio).toBe(0);
  });
});

describe("calcularFunil", () => {
  it("conta cumulativo: lead que já passou por uma etapa e avançou continua contando nela", () => {
    // Lead criado em prospecção, moveu pra contato, depois pra proposta —
    // deve contar em TODAS as 3 etapas, não só na atual (proposta).
    const leads = [lead({ id: "1", etapa: "proposta" })];
    const historico = [
      mudancaEtapa({ lead_id: "1", etapa_anterior: "prospeccao", etapa_nova: "contato" }),
      mudancaEtapa({ lead_id: "1", etapa_anterior: "contato", etapa_nova: "proposta" }),
    ];

    const funil = calcularFunil(leads, historico);
    const porEtapa = Object.fromEntries(funil.etapas.map((e) => [e.etapa, e.quantidade]));

    expect(porEtapa.prospeccao).toBe(1);
    expect(porEtapa.contato).toBe(1);
    expect(porEtapa.proposta).toBe(1);
    expect(porEtapa.negociacao).toBe(0);
  });

  it("ignora histórico de leads fora do conjunto filtrado", () => {
    const leads = [lead({ id: "1", etapa: "prospeccao" })];
    const historico = [
      mudancaEtapa({ lead_id: "outro-lead", etapa_anterior: "prospeccao", etapa_nova: "fechado" }),
    ];

    const funil = calcularFunil(leads, historico);
    const fechado = funil.etapas.find((e) => e.etapa === "fechado");
    expect(fechado?.quantidade).toBe(0);
  });

  it("identifica o gargalo como a maior queda percentual entre etapas consecutivas", () => {
    // Funil "afunilando" a cada etapa (6 → 3 → 2 → 1 → 1), com a MAIOR queda
    // relativa logo na primeira transição (prospecção 6 → contato 3, -50%) —
    // as demais quedas (proposta→negociação também -50%, mas só a PRIMEIRA
    // ocorrência empatada deve ganhar) e a última transição (negociação→
    // fechado, 0% de queda, todo mundo que chegou em negociação fechou) não
    // devem ofuscar o gargalo real.
    const leads = [
      lead({ id: "1", etapa: "fechado" }),
      lead({ id: "2", etapa: "proposta" }),
      lead({ id: "3", etapa: "contato" }),
      lead({ id: "4", etapa: "prospeccao" }),
      lead({ id: "5", etapa: "prospeccao" }),
      lead({ id: "6", etapa: "prospeccao" }),
    ];
    const historico = [
      mudancaEtapa({ lead_id: "1", etapa_anterior: "prospeccao", etapa_nova: "contato" }),
      mudancaEtapa({ lead_id: "1", etapa_anterior: "contato", etapa_nova: "proposta" }),
      mudancaEtapa({ lead_id: "1", etapa_anterior: "proposta", etapa_nova: "negociacao" }),
      mudancaEtapa({ lead_id: "1", etapa_anterior: "negociacao", etapa_nova: "fechado" }),
      mudancaEtapa({ lead_id: "2", etapa_anterior: "prospeccao", etapa_nova: "contato" }),
      mudancaEtapa({ lead_id: "2", etapa_anterior: "contato", etapa_nova: "proposta" }),
      mudancaEtapa({ lead_id: "3", etapa_anterior: "prospeccao", etapa_nova: "contato" }),
    ];

    const funil = calcularFunil(leads, historico);
    expect(funil.gargalo?.deEtapa).toBe("Prospecção");
    expect(funil.gargalo?.paraEtapa).toBe("Contato");
  });
});

describe("calcularTempoMedioPorEtapa", () => {
  it("lead sem histórico conta como um segmento na etapa atual desde a criação", () => {
    const agora = new Date("2026-01-11T00:00:00Z");
    const leads = [lead({ id: "1", etapa: "contato", created_at: "2026-01-01T00:00:00Z" })];

    const tempos = calcularTempoMedioPorEtapa(leads, [], agora);
    const contato = tempos.find((t) => t.etapa === "contato");
    expect(contato?.diasMedio).toBeCloseTo(10, 5);
  });

  it("calcula a duração de cada segmento entre mudanças de etapa", () => {
    const agora = new Date("2026-01-20T00:00:00Z");
    const leads = [lead({ id: "1", etapa: "proposta", created_at: "2026-01-01T00:00:00Z" })];
    const historico = [
      mudancaEtapa({ lead_id: "1", etapa_nova: "prospeccao", data_mudanca: "2026-01-01T00:00:00Z", tipo_mudanca: "criacao" }),
      mudancaEtapa({ lead_id: "1", etapa_anterior: "prospeccao", etapa_nova: "contato", data_mudanca: "2026-01-06T00:00:00Z" }),
      mudancaEtapa({ lead_id: "1", etapa_anterior: "contato", etapa_nova: "proposta", data_mudanca: "2026-01-16T00:00:00Z" }),
    ];

    const tempos = calcularTempoMedioPorEtapa(leads, historico, agora);
    const porEtapa = Object.fromEntries(tempos.map((t) => [t.etapa, t.diasMedio]));

    expect(porEtapa.prospeccao).toBeCloseTo(5, 5); // 01→06
    expect(porEtapa.contato).toBeCloseTo(10, 5); // 06→16
    expect(porEtapa.proposta).toBeCloseTo(4, 5); // 16→20 (agora)
  });
});

describe("calcularLeadsPorOrigem", () => {
  it("agrupa por origem e calcula percentual, tratando origem vazia como 'Não informado'", () => {
    const leads = [
      lead({ id: "1", origem: "Site" }),
      lead({ id: "2", origem: "Site" }),
      lead({ id: "3", origem: null }),
    ];
    const resultado = calcularLeadsPorOrigem(leads);
    const site = resultado.find((o) => o.origem === "Site");
    expect(site?.quantidade).toBe(2);
    expect(site?.percentual).toBeCloseTo(66.66, 1);
    expect(resultado.find((o) => o.origem === "Não informado")?.quantidade).toBe(1);
  });
});

describe("calcularPerformancePorResponsavel", () => {
  it("calcula taxa de fechamento por responsável", () => {
    const leads = [
      lead({ id: "1", atribuido_a: "a@x.com", etapa: "fechado" }),
      lead({ id: "2", atribuido_a: "a@x.com", etapa: "contato" }),
      lead({ id: "3", atribuido_a: "b@x.com", etapa: "contato" }),
    ];
    const resultado = calcularPerformancePorResponsavel(leads);
    const a = resultado.find((r) => r.atribuidoA === "a@x.com");
    expect(a?.totalLeads).toBe(2);
    expect(a?.fechados).toBe(1);
    expect(a?.taxaFechamentoPercentual).toBe(50);
  });
});

describe("calcularLeadsDormindo", () => {
  it("inclui leads ativos sem interação há 7+ dias, exclui fechados/perdidos", () => {
    const agora = new Date("2026-01-20T00:00:00Z");
    const leads = [
      lead({ id: "1", etapa: "contato", data_ultima_interacao: "2026-01-01T00:00:00Z" }), // 19 dias — dormindo
      lead({ id: "2", etapa: "contato", data_ultima_interacao: "2026-01-19T00:00:00Z" }), // 1 dia — não
      lead({ id: "3", etapa: "fechado", data_ultima_interacao: "2026-01-01T00:00:00Z" }), // fechado — excluído
    ];
    const dormindo = calcularLeadsDormindo(leads, agora);
    expect(dormindo.map((l) => l.id)).toEqual(["1"]);
  });

  it("usa created_at quando nunca houve interação", () => {
    const agora = new Date("2026-01-20T00:00:00Z");
    const leads = [lead({ id: "1", etapa: "prospeccao", created_at: "2026-01-01T00:00:00Z", data_ultima_interacao: null })];
    expect(calcularLeadsDormindo(leads, agora).map((l) => l.id)).toEqual(["1"]);
  });
});

describe("calcularLeadsFriosResumo", () => {
  function agendamento(overrides: Partial<AgendamentoLeadFrio> = {}): AgendamentoLeadFrio {
    return {
      id: "a1",
      lead_id: "l1",
      temperatura_anterior: "morno",
      etapa_anterior: "contato",
      data_agendamento: "2026-01-01T00:00:00Z",
      data_retorno: "2026-01-01T00:00:00Z",
      intervalo_dias: 20,
      status: "agendado",
      motivo_cancelamento: null,
      created_at: "2026-01-01T00:00:00Z",
      reativado_em: null,
      ...overrides,
    };
  }

  it("distribui em 3 baldes mutuamente exclusivos que somam o total", () => {
    const agora = new Date("2026-01-10T12:00:00Z");
    const agendamentos = [
      agendamento({ id: "hoje", data_retorno: "2026-01-10T18:00:00Z" }),
      agendamento({ id: "em5dias", data_retorno: "2026-01-15T00:00:00Z" }),
      agendamento({ id: "em20dias", data_retorno: "2026-01-30T00:00:00Z" }),
      agendamento({ id: "cancelado", status: "cancelado", data_retorno: "2026-01-11T00:00:00Z" }),
    ];

    const resumo = calcularLeadsFriosResumo(agendamentos, agora);
    expect(resumo.total).toBe(3); // cancelado não conta
    expect(resumo.reativandoHoje).toBe(1);
    expect(resumo.proximos7Dias).toBe(1);
    expect(resumo.proximos30Dias).toBe(1);
  });
});
