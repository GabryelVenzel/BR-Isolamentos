import { anexarPrazoEtapa, calcularDiasNaEtapaAtual } from "@/lib/usecases/comercial";
import type { ConfigPrazoEtapas, HistoricoMudancaLead, Lead } from "@/lib/types/domain";

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
    eh_comissao: false,
    parceiro_id: null,
    valor_indicado: null,
    percentual_comissao: null,
    valor_comissao: null,
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

function config(overrides: Partial<ConfigPrazoEtapas> = {}): ConfigPrazoEtapas {
  return {
    id: 1,
    dias_prospeccao: 7,
    dias_contato: 10,
    dias_proposta: 15,
    dias_negociacao: 20,
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("calcularDiasNaEtapaAtual", () => {
  it("sem histórico, usa created_at como referência", () => {
    const agora = new Date("2026-01-11T00:00:00Z");
    const l = lead({ created_at: "2026-01-01T00:00:00Z" });
    expect(calcularDiasNaEtapaAtual(l, [], agora)).toBeCloseTo(10, 5);
  });

  it("usa a mudança de etapa mais recente, ignorando entradas mais antigas", () => {
    const agora = new Date("2026-01-20T00:00:00Z");
    const l = lead({ etapa: "proposta", created_at: "2026-01-01T00:00:00Z" });
    const historico = [
      mudancaEtapa({ etapa_nova: "contato", data_mudanca: "2026-01-05T00:00:00Z" }),
      mudancaEtapa({ etapa_nova: "proposta", data_mudanca: "2026-01-15T00:00:00Z" }),
    ];
    expect(calcularDiasNaEtapaAtual(l, historico, agora)).toBeCloseTo(5, 5); // 15→20
  });

  it("ignora histórico de outros leads", () => {
    const agora = new Date("2026-01-11T00:00:00Z");
    const l = lead({ id: "l1", created_at: "2026-01-01T00:00:00Z" });
    const historico = [mudancaEtapa({ lead_id: "outro-lead", etapa_nova: "fechado", data_mudanca: "2026-01-10T00:00:00Z" })];
    expect(calcularDiasNaEtapaAtual(l, historico, agora)).toBeCloseTo(10, 5); // não afetado
  });
});

describe("anexarPrazoEtapa", () => {
  it("marca etapa_atrasada quando dias na etapa excede o prazo configurado", () => {
    const agora = new Date("2026-01-11T00:00:00Z"); // 10 dias desde created_at
    const leads = [lead({ id: "1", etapa: "prospeccao", created_at: "2026-01-01T00:00:00Z" })]; // prazo prospeccao = 7
    const resultado = anexarPrazoEtapa(leads, [], config(), agora);
    expect(resultado[0].dias_na_etapa_atual).toBeCloseTo(10, 5);
    expect(resultado[0].etapa_atrasada).toBe(true);
  });

  it("não marca atrasado quando ainda dentro do prazo", () => {
    const agora = new Date("2026-01-04T00:00:00Z"); // 3 dias
    const leads = [lead({ id: "1", etapa: "prospeccao", created_at: "2026-01-01T00:00:00Z" })];
    const resultado = anexarPrazoEtapa(leads, [], config(), agora);
    expect(resultado[0].etapa_atrasada).toBe(false);
  });

  it("etapas terminais (fechado/perdido) nunca são atrasadas, mesmo há muito tempo", () => {
    const agora = new Date("2027-01-01T00:00:00Z");
    const leads = [
      lead({ id: "1", etapa: "fechado", created_at: "2026-01-01T00:00:00Z" }),
      lead({ id: "2", etapa: "perdido", created_at: "2026-01-01T00:00:00Z" }),
    ];
    const resultado = anexarPrazoEtapa(leads, [], config(), agora);
    expect(resultado.every((l) => l.etapa_atrasada === false)).toBe(true);
  });

  it("sem configuração carregada, nenhum lead é marcado como atrasado (degrada sem quebrar)", () => {
    const agora = new Date("2027-01-01T00:00:00Z");
    const leads = [lead({ id: "1", etapa: "prospeccao", created_at: "2026-01-01T00:00:00Z" })];
    const resultado = anexarPrazoEtapa(leads, [], null, agora);
    expect(resultado[0].etapa_atrasada).toBe(false);
    expect(resultado[0].dias_na_etapa_atual).toBeGreaterThan(0);
  });
});
