import { NotFoundError } from "@/lib/errors";
import { moverLead } from "@/lib/usecases/comercial";
import type { Lead } from "@/lib/types/domain";

function criarLeadFake(overrides: Partial<Lead> = {}): Lead {
  return {
    id: "lead-1",
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
    etapa_anterior: null,
    temperatura_anterior: null,
    data_ultima_interacao: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

/** Fake mínimo do LeadRepository — só os métodos que moverLead usa. */
function criarLeadRepoFake(leadInicial: Lead) {
  let estado = leadInicial;
  return {
    findById: jest.fn(async (_id: string) => estado),
    update: jest.fn(async (_id: string, dados: Partial<Lead>) => {
      estado = { ...estado, ...dados };
      return estado;
    }),
  };
}

function criarHistoricoRepoFake() {
  return { create: jest.fn(async (dados: unknown) => dados) };
}

describe("moverLead", () => {
  // Decisão explícita do CRM: qualquer transição de etapa é permitida —
  // substitui a antiga máquina de estados fixa (TRANSICOES_FUNIL), removida
  // de propósito (ver comentário em lib/usecases/comercial/moverLead.ts).

  it("move o lead para qualquer etapa, mesmo fora de ordem", async () => {
    const leadRepo = criarLeadRepoFake(criarLeadFake({ etapa: "prospeccao" }));
    const historicoRepo = criarHistoricoRepoFake();

    const resultado = await moverLead(
      { leadId: "lead-1", novaEtapa: "fechado" },
      { leadRepo: leadRepo as never, historicoRepo: historicoRepo as never }
    );

    expect(resultado.etapa).toBe("fechado");
    expect(leadRepo.update).toHaveBeenCalledWith("lead-1", { etapa: "fechado", etapa_anterior: "prospeccao" });
  });

  it("permite reabrir um lead já em etapa terminal (fechado/perdido)", async () => {
    const leadRepo = criarLeadRepoFake(criarLeadFake({ etapa: "perdido" }));
    const historicoRepo = criarHistoricoRepoFake();

    const resultado = await moverLead(
      { leadId: "lead-1", novaEtapa: "contato" },
      { leadRepo: leadRepo as never, historicoRepo: historicoRepo as never }
    );

    expect(resultado.etapa).toBe("contato");
  });

  it("grava uma entrada no histórico a cada mudança de etapa, com o e-mail de quem moveu", async () => {
    const leadRepo = criarLeadRepoFake(criarLeadFake({ etapa: "contato" }));
    const historicoRepo = criarHistoricoRepoFake();

    await moverLead(
      { leadId: "lead-1", novaEtapa: "proposta" },
      { leadRepo: leadRepo as never, historicoRepo: historicoRepo as never },
      "consultor@brisolamentos.com"
    );

    expect(historicoRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        lead_id: "lead-1",
        tipo_mudanca: "mudanca_etapa",
        etapa_anterior: "contato",
        etapa_nova: "proposta",
        usuario_email: "consultor@brisolamentos.com",
      })
    );
  });

  it("é idempotente: mover para a etapa atual não grava histórico nem atualiza", async () => {
    const leadRepo = criarLeadRepoFake(criarLeadFake({ etapa: "negociacao" }));
    const historicoRepo = criarHistoricoRepoFake();

    const resultado = await moverLead(
      { leadId: "lead-1", novaEtapa: "negociacao" },
      { leadRepo: leadRepo as never, historicoRepo: historicoRepo as never }
    );

    expect(resultado.etapa).toBe("negociacao");
    expect(leadRepo.update).not.toHaveBeenCalled();
    expect(historicoRepo.create).not.toHaveBeenCalled();
  });

  it("lança NotFoundError quando o lead não existe", async () => {
    const leadRepo = { findById: jest.fn(async () => null), update: jest.fn() };
    const historicoRepo = criarHistoricoRepoFake();

    await expect(
      moverLead(
        { leadId: "inexistente", novaEtapa: "contato" },
        { leadRepo: leadRepo as never, historicoRepo: historicoRepo as never }
      )
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
