import { listarAlertas } from "@/lib/usecases/resumo";
import type { Lead } from "@/lib/types/domain";

function lead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: "l1",
    numero_lead: "L00001",
    cliente_id: 1,
    etapa: "contato",
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

function reposFake(leads: Lead[]) {
  return {
    lancamentoRepo: { listarAReceber: jest.fn(async () => []) },
    leadRepo: { listar: jest.fn(async () => leads) },
    parceiroRepo: { capacidadeView: jest.fn(async () => []) },
  };
}

describe("listarAlertas — leads sem contato", () => {
  it("usa 'sem contato há 7+ dias' (calcularLeadsDormindo), não mais data_proxima_acao", async () => {
    const leads = [
      lead({ id: "l1", data_ultima_interacao: "2020-01-01T00:00:00Z" }), // bem antigo, dormindo
      lead({ id: "l2", data_ultima_interacao: new Date().toISOString() }), // acabou de interagir
    ];
    const repos = reposFake(leads);

    const alertas = await listarAlertas(repos as never, null);

    const alertaLeads = alertas.find((a) => a.id === "leads-sem-contato");
    expect(alertaLeads?.mensagem).toContain("sem contato há 7+ dias");
    expect(alertaLeads?.mensagem).toContain("1 lead");
  });

  it("aponta pra Resumo → Comercial (não mais /comercial genérico)", async () => {
    const repos = reposFake([lead({ data_ultima_interacao: "2020-01-01T00:00:00Z" })]);

    const alertas = await listarAlertas(repos as never, null);

    const alertaLeads = alertas.find((a) => a.id === "leads-sem-contato");
    expect(alertaLeads?.href).toBe("/resumo?tab=comercial");
  });

  it("não gera alerta se nenhum lead está dormindo", async () => {
    const repos = reposFake([lead({ data_ultima_interacao: new Date().toISOString() })]);

    const alertas = await listarAlertas(repos as never, null);

    expect(alertas.find((a) => a.id === "leads-sem-contato")).toBeUndefined();
  });

  it("ignora leads fechados/perdidos mesmo sem interação recente", async () => {
    const repos = reposFake([
      lead({ etapa: "fechado", data_ultima_interacao: "2020-01-01T00:00:00Z" }),
      lead({ etapa: "perdido", data_ultima_interacao: "2020-01-01T00:00:00Z" }),
    ]);

    const alertas = await listarAlertas(repos as never, null);

    expect(alertas.find((a) => a.id === "leads-sem-contato")).toBeUndefined();
  });
});
