import { ConflictError, NotFoundError } from "@/lib/errors";
import { moverLead, TRANSICOES_FUNIL } from "@/lib/usecases/comercial";
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

describe("TRANSICOES_FUNIL", () => {
  it("etapas terminais (fechado/perdido) não têm transição de saída", () => {
    expect(TRANSICOES_FUNIL.fechado).toEqual([]);
    expect(TRANSICOES_FUNIL.perdido).toEqual([]);
  });

  it("qualquer etapa ativa pode ir para 'perdido'", () => {
    expect(TRANSICOES_FUNIL.prospeccao).toContain("perdido");
    expect(TRANSICOES_FUNIL.contato).toContain("perdido");
    expect(TRANSICOES_FUNIL.proposta).toContain("perdido");
    expect(TRANSICOES_FUNIL.negociacao).toContain("perdido");
  });
});

describe("moverLead", () => {
  it("move o lead quando a transição é permitida", async () => {
    const leadRepo = criarLeadRepoFake(criarLeadFake({ etapa: "prospeccao" }));

    const resultado = await moverLead({ leadId: "lead-1", novaEtapa: "contato" }, { leadRepo: leadRepo as never });

    expect(resultado.etapa).toBe("contato");
    expect(leadRepo.update).toHaveBeenCalledWith("lead-1", { etapa: "contato" });
  });

  it("rejeita transição fora de ordem (ex.: prospecção direto para fechado)", async () => {
    const leadRepo = criarLeadRepoFake(criarLeadFake({ etapa: "prospeccao" }));

    await expect(
      moverLead({ leadId: "lead-1", novaEtapa: "fechado" }, { leadRepo: leadRepo as never })
    ).rejects.toBeInstanceOf(ConflictError);
    expect(leadRepo.update).not.toHaveBeenCalled();
  });

  it("rejeita mover um lead já em etapa terminal (fechado)", async () => {
    const leadRepo = criarLeadRepoFake(criarLeadFake({ etapa: "fechado" }));

    await expect(
      moverLead({ leadId: "lead-1", novaEtapa: "contato" }, { leadRepo: leadRepo as never })
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("é idempotente: mover para a etapa atual não é erro nem grava nada", async () => {
    const leadRepo = criarLeadRepoFake(criarLeadFake({ etapa: "negociacao" }));

    const resultado = await moverLead(
      { leadId: "lead-1", novaEtapa: "negociacao" },
      { leadRepo: leadRepo as never }
    );

    expect(resultado.etapa).toBe("negociacao");
    expect(leadRepo.update).not.toHaveBeenCalled();
  });

  it("lança NotFoundError quando o lead não existe", async () => {
    const leadRepo = { findById: jest.fn(async () => null), update: jest.fn() };

    await expect(
      moverLead({ leadId: "inexistente", novaEtapa: "contato" }, { leadRepo: leadRepo as never })
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
