import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { desvincularOrcamento, moverLead, vincularOrcamento } from "@/lib/usecases/comercial";
import type { Lead, LeadOrcamento } from "@/lib/types/domain";
import type { Orcamento } from "@/lib/types";

function leadFake(overrides: Partial<Lead> = {}): Lead {
  return {
    id: "lead-1",
    numero_lead: "L00001",
    cliente_id: 1,
    etapa: "contato",
    temperatura: "morno",
    valor_estimado: 1000,
    valor_fechado: null,
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

function orcamentoFake(overrides: Partial<Orcamento> = {}): Orcamento {
  return {
    id: 42,
    numero: "ORC-2026-0001",
    numero_orcamento: "O00001",
    cliente_id: 1,
    data_criacao: "2026-01-01",
    tipo_trabalho: "quente",
    tipo_proposta: "material_mo",
    valor_materiais: 0,
    valor_mao_obra: 0,
    valor_deslocamento: 0,
    valor_hospedagem: 0,
    valor_frete: 0,
    valor_aluguel_carro: 0,
    valor_alimentacao: 0,
    horas_uteis_dia: null,
    subtotal: 0,
    detalhamento_impostos: [],
    total_impostos: 0,
    margem_lucro: 0,
    valor_desconto: 0,
    preco_cheio: 0,
    valor_final: 15000,
    status: "rascunho",
    proposta_pdf_url: null,
    criado_por: null,
    criado_em: "2026-01-01T00:00:00Z",
    atualizado_em: "2026-01-01T00:00:00Z",
    atribuido_a: null,
    observacoes_adicionais: null,
    ...overrides,
  };
}

function vinculo(orcamentoId: number, vencedor = false): LeadOrcamento {
  return { id: `v-${orcamentoId}`, lead_id: "lead-1", orcamento_id: orcamentoId, vencedor, created_at: "2026-01-01T00:00:00Z", orcamento: orcamentoFake({ id: orcamentoId, numero: `ORC-${orcamentoId}` }) };
}

function repos(lead: Lead, orcamento: Orcamento | null = orcamentoFake()) {
  return {
    leadRepo: {
      findById: jest.fn(async () => lead),
      update: jest.fn(async (_id: string, dados: Partial<Lead>) => ({ ...lead, ...dados })),
    },
    orcamentoRepo: {
      findById: jest.fn(async () => orcamento),
      update: jest.fn(async (id: number, dados: unknown) => ({ id, ...(dados as object) })),
    },
    historicoRepo: { create: jest.fn(async (dados: unknown) => dados) },
    leadOrcamentoRepo: { vincular: jest.fn(), desvincular: jest.fn(), definirVencedores: jest.fn() },
  };
}

describe("vincularOrcamento (vários orçamentos por lead — migração 053)", () => {
  it("vincula mais um orçamento e marca como enviado", async () => {
    const r = repos(leadFake({ vinculos: [vinculo(10)] }));
    await vincularOrcamento({ leadId: "lead-1", orcamentoId: 42 }, r as never);
    expect(r.leadOrcamentoRepo.vincular).toHaveBeenCalledWith("lead-1", 42);
    expect(r.orcamentoRepo.update).toHaveBeenCalledWith(42, { status: "enviado" });
  });

  it("NÃO altera valor_estimado do lead", async () => {
    const r = repos(leadFake({ valor_estimado: 1000 }), orcamentoFake({ valor_final: 15000 }));
    const resultado = await vincularOrcamento({ leadId: "lead-1", orcamentoId: 42 }, r as never);
    expect(resultado.valor_estimado).toBe(1000);
    expect(r.leadRepo.update).not.toHaveBeenCalled();
  });

  it("orçamento já vinculado: não duplica", async () => {
    const r = repos(leadFake({ vinculos: [vinculo(42)] }));
    await vincularOrcamento({ leadId: "lead-1", orcamentoId: 42 }, r as never);
    expect(r.leadOrcamentoRepo.vincular).not.toHaveBeenCalled();
  });

  it("lead fechado não recebe orçamento novo", async () => {
    const r = repos(leadFake({ etapa: "fechado" }));
    await expect(vincularOrcamento({ leadId: "lead-1", orcamentoId: 42 }, r as never)).rejects.toBeInstanceOf(ConflictError);
  });

  it("lança NotFoundError se o orçamento não existe", async () => {
    const r = repos(leadFake(), null);
    await expect(vincularOrcamento({ leadId: "lead-1", orcamentoId: 999 }, r as never)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("desvincularOrcamento", () => {
  it("remove em Proposta e o orçamento volta a proposta", async () => {
    const r = repos(leadFake({ etapa: "proposta", vinculos: [vinculo(42), vinculo(43)] }));
    await desvincularOrcamento({ leadId: "lead-1", orcamentoId: 42 }, r as never);
    expect(r.leadOrcamentoRepo.desvincular).toHaveBeenCalledWith("lead-1", 42);
    expect(r.orcamentoRepo.update).toHaveBeenCalledWith(42, { status: "proposta" });
  });

  it.each(["negociacao", "fechado", "perdido"] as const)("bloqueia em %s — precisa voltar para Proposta", async (etapa) => {
    const r = repos(leadFake({ etapa, vinculos: [vinculo(42)] }));
    await expect(desvincularOrcamento({ leadId: "lead-1", orcamentoId: 42 }, r as never)).rejects.toBeInstanceOf(ConflictError);
    expect(r.leadOrcamentoRepo.desvincular).not.toHaveBeenCalled();
  });
});

describe("moverLead com vários orçamentos", () => {
  it("fechar: vencedor vira aceito e os outros rejeitado", async () => {
    const r = repos(leadFake({ etapa: "negociacao", vinculos: [vinculo(42), vinculo(43)] }));
    await moverLead({ leadId: "lead-1", novaEtapa: "fechado", valorFechado: 5000, orcamentosVencedores: [43] }, r as never);
    expect(r.orcamentoRepo.update).toHaveBeenCalledWith(43, { status: "aceito" });
    expect(r.orcamentoRepo.update).toHaveBeenCalledWith(42, { status: "rejeitado" });
    expect(r.leadOrcamentoRepo.definirVencedores).toHaveBeenCalledWith("lead-1", [43]);
  });

  it("fechar com vários sem escolher: pede o vencedor", async () => {
    const r = repos(leadFake({ etapa: "negociacao", vinculos: [vinculo(42), vinculo(43)] }));
    await expect(moverLead({ leadId: "lead-1", novaEtapa: "fechado", valorFechado: 5000 }, r as never)).rejects.toBeInstanceOf(ValidationError);
  });

  it("fechar com um só: ele é o vencedor", async () => {
    const r = repos(leadFake({ etapa: "negociacao", vinculos: [vinculo(42)] }));
    await moverLead({ leadId: "lead-1", novaEtapa: "fechado", valorFechado: 5000 }, r as never);
    expect(r.orcamentoRepo.update).toHaveBeenCalledWith(42, { status: "aceito" });
    expect(r.leadOrcamentoRepo.definirVencedores).toHaveBeenCalledWith("lead-1", [42]);
  });

  it("reabrir um fechado: limpa os vencedores e todos voltam a enviado", async () => {
    const r = repos(leadFake({ etapa: "fechado", valor_fechado: 5000, vinculos: [vinculo(42, true), vinculo(43)] }));
    await moverLead({ leadId: "lead-1", novaEtapa: "negociacao" }, r as never);
    expect(r.orcamentoRepo.update).toHaveBeenCalledWith(42, { status: "enviado" });
    expect(r.orcamentoRepo.update).toHaveBeenCalledWith(43, { status: "enviado" });
    expect(r.leadOrcamentoRepo.definirVencedores).toHaveBeenCalledWith("lead-1", []);
  });
});
