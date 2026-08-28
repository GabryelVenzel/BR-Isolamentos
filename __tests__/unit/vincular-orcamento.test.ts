import { NotFoundError } from "@/lib/errors";
import { vincularOrcamento } from "@/lib/usecases/comercial";
import type { Lead } from "@/lib/types/domain";
import type { Orcamento } from "@/lib/types";

function leadFake(overrides: Partial<Lead> = {}): Lead {
  return {
    id: "lead-1",
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

describe("vincularOrcamento", () => {
  it("marca o orçamento como 'enviado' ao vincular a um lead", async () => {
    const leadRepo = {
      findById: jest.fn(async () => leadFake()),
      update: jest.fn(async (_id: string, dados: Partial<Lead>) => ({ ...leadFake(), ...dados })),
    };
    const orcamentoRepo = {
      findById: jest.fn(async () => orcamentoFake()),
      update: jest.fn(async (id: number, dados: unknown) => ({ id, ...(dados as object) })),
    };
    const historicoRepo = { create: jest.fn(async (dados: unknown) => dados) };

    await vincularOrcamento(
      { leadId: "lead-1", orcamentoId: 42 },
      { leadRepo: leadRepo as never, orcamentoRepo: orcamentoRepo as never, historicoRepo: historicoRepo as never }
    );

    expect(orcamentoRepo.update).toHaveBeenCalledWith(42, { status: "enviado" });
  });

  it("NÃO altera valor_estimado do lead — independente do valor_final do orçamento (revertido por pedido)", async () => {
    const leadRepo = {
      findById: jest.fn(async () => leadFake({ valor_estimado: 1000 })),
      update: jest.fn(async (_id: string, dados: Partial<Lead>) => ({ ...leadFake({ valor_estimado: 1000 }), ...dados })),
    };
    const orcamentoRepo = {
      findById: jest.fn(async () => orcamentoFake({ valor_final: 15000 })),
      update: jest.fn(async () => undefined),
    };
    const historicoRepo = { create: jest.fn(async (dados: unknown) => dados) };

    const resultado = await vincularOrcamento(
      { leadId: "lead-1", orcamentoId: 42 },
      { leadRepo: leadRepo as never, orcamentoRepo: orcamentoRepo as never, historicoRepo: historicoRepo as never }
    );

    expect(resultado.valor_estimado).toBe(1000);
    expect(leadRepo.update).toHaveBeenCalledWith("lead-1", { orcamento_id: 42 });
  });

  it("lança NotFoundError se o orçamento não existe", async () => {
    const leadRepo = { findById: jest.fn(async () => leadFake()), update: jest.fn() };
    const orcamentoRepo = { findById: jest.fn(async () => null), update: jest.fn() };
    const historicoRepo = { create: jest.fn() };

    await expect(
      vincularOrcamento(
        { leadId: "lead-1", orcamentoId: 999 },
        { leadRepo: leadRepo as never, orcamentoRepo: orcamentoRepo as never, historicoRepo: historicoRepo as never }
      )
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
