import { ConflictError, NotFoundError } from "@/lib/errors";
import { moverLead } from "@/lib/usecases/comercial";
import type { Lead } from "@/lib/types/domain";

function criarLeadFake(overrides: Partial<Lead> = {}): Lead {
  return {
    id: "lead-1",
    numero_lead: "L00001",
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
    // orcamento_id preenchido só pra não esbarrar na regra de bloqueio de
    // "negociacao" sem orçamento (ver Problema 2) — este teste é sobre o
    // registro de histórico, não sobre essa regra.
    const leadRepo = criarLeadRepoFake(criarLeadFake({ etapa: "contato", orcamento_id: 42 }));
    const historicoRepo = criarHistoricoRepoFake();

    await moverLead(
      { leadId: "lead-1", novaEtapa: "negociacao" },
      { leadRepo: leadRepo as never, historicoRepo: historicoRepo as never },
      "consultor@brisolamentos.com"
    );

    expect(historicoRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        lead_id: "lead-1",
        tipo_mudanca: "mudanca_etapa",
        etapa_anterior: "contato",
        etapa_nova: "negociacao",
        usuario_email: "consultor@brisolamentos.com",
      })
    );
  });

  it("permite mover pra 'proposta' SEM orçamento vinculado (bloqueio mudou pra 'negociação')", async () => {
    const leadRepo = criarLeadRepoFake(criarLeadFake({ etapa: "contato", orcamento_id: null }));
    const historicoRepo = criarHistoricoRepoFake();

    const resultado = await moverLead(
      { leadId: "lead-1", novaEtapa: "proposta" },
      { leadRepo: leadRepo as never, historicoRepo: historicoRepo as never }
    );

    expect(resultado.etapa).toBe("proposta");
  });

  it("bloqueia mover pra 'negociação' sem orçamento vinculado (única exceção à regra de transição livre)", async () => {
    const leadRepo = criarLeadRepoFake(criarLeadFake({ etapa: "proposta", orcamento_id: null }));
    const historicoRepo = criarHistoricoRepoFake();

    await expect(
      moverLead(
        { leadId: "lead-1", novaEtapa: "negociacao" },
        { leadRepo: leadRepo as never, historicoRepo: historicoRepo as never }
      )
    ).rejects.toBeInstanceOf(ConflictError);
    expect(leadRepo.update).not.toHaveBeenCalled();
  });

  it("permite mover pra 'negociação' quando já tem orçamento vinculado", async () => {
    const leadRepo = criarLeadRepoFake(criarLeadFake({ etapa: "proposta", orcamento_id: 42 }));
    const historicoRepo = criarHistoricoRepoFake();

    const resultado = await moverLead(
      { leadId: "lead-1", novaEtapa: "negociacao" },
      { leadRepo: leadRepo as never, historicoRepo: historicoRepo as never }
    );

    expect(resultado.etapa).toBe("negociacao");
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

  // Status do orçamento é computado a partir da etapa do lead (não editado
  // manualmente) — ver STATUS_ORCAMENTO_POR_ETAPA em moverLead.ts.
  function criarOrcamentoRepoFake() {
    return { update: jest.fn(async (id: number, dados: unknown) => ({ id, ...(dados as object) })) };
  }

  it("move pra 'fechado' com orçamento vinculado marca o orçamento como 'aceito'", async () => {
    const leadRepo = criarLeadRepoFake(criarLeadFake({ etapa: "negociacao", orcamento_id: 42 }));
    const historicoRepo = criarHistoricoRepoFake();
    const orcamentoRepo = criarOrcamentoRepoFake();

    await moverLead(
      { leadId: "lead-1", novaEtapa: "fechado" },
      { leadRepo: leadRepo as never, historicoRepo: historicoRepo as never, orcamentoRepo: orcamentoRepo as never }
    );

    expect(orcamentoRepo.update).toHaveBeenCalledWith(42, { status: "aceito" });
  });

  it("move pra 'perdido' com orçamento vinculado marca o orçamento como 'rejeitado'", async () => {
    const leadRepo = criarLeadRepoFake(criarLeadFake({ etapa: "negociacao", orcamento_id: 42 }));
    const historicoRepo = criarHistoricoRepoFake();
    const orcamentoRepo = criarOrcamentoRepoFake();

    await moverLead(
      { leadId: "lead-1", novaEtapa: "perdido" },
      { leadRepo: leadRepo as never, historicoRepo: historicoRepo as never, orcamentoRepo: orcamentoRepo as never }
    );

    expect(orcamentoRepo.update).toHaveBeenCalledWith(42, { status: "rejeitado" });
  });

  it("reabrir um lead 'fechado' de volta pra 'negociacao' reverte o orçamento pra 'enviado'", async () => {
    const leadRepo = criarLeadRepoFake(criarLeadFake({ etapa: "fechado", orcamento_id: 42 }));
    const historicoRepo = criarHistoricoRepoFake();
    const orcamentoRepo = criarOrcamentoRepoFake();

    await moverLead(
      { leadId: "lead-1", novaEtapa: "negociacao" },
      { leadRepo: leadRepo as never, historicoRepo: historicoRepo as never, orcamentoRepo: orcamentoRepo as never }
    );

    expect(orcamentoRepo.update).toHaveBeenCalledWith(42, { status: "enviado" });
  });

  it("não tenta atualizar orçamento quando o lead não tem um vinculado", async () => {
    const leadRepo = criarLeadRepoFake(criarLeadFake({ etapa: "negociacao", orcamento_id: null }));
    const historicoRepo = criarHistoricoRepoFake();
    const orcamentoRepo = criarOrcamentoRepoFake();

    await moverLead(
      { leadId: "lead-1", novaEtapa: "fechado" },
      { leadRepo: leadRepo as never, historicoRepo: historicoRepo as never, orcamentoRepo: orcamentoRepo as never }
    );

    expect(orcamentoRepo.update).not.toHaveBeenCalled();
  });

  it("não quebra quando orcamentoRepo não é passado (compatibilidade)", async () => {
    const leadRepo = criarLeadRepoFake(criarLeadFake({ etapa: "negociacao", orcamento_id: 42 }));
    const historicoRepo = criarHistoricoRepoFake();

    const resultado = await moverLead(
      { leadId: "lead-1", novaEtapa: "fechado" },
      { leadRepo: leadRepo as never, historicoRepo: historicoRepo as never }
    );

    expect(resultado.etapa).toBe("fechado");
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

  // --- Lead de comissão (migração 026) ---

  function criarAnexoLeadRepoFake(totalAnexos: number) {
    return { contarPorLead: jest.fn(async () => totalAnexos) };
  }

  function criarLancamentoRepoFake() {
    return { create: jest.fn(async (dados: unknown) => ({ id: "lanc-1", ...(dados as object) })) };
  }

  it("comissão SEM orçamento pode ir pra negociação (não é a mesma exigência de lead normal)", async () => {
    const leadRepo = criarLeadRepoFake(criarLeadFake({ etapa: "proposta", eh_comissao: true, orcamento_id: null }));
    const historicoRepo = criarHistoricoRepoFake();
    const anexoLeadRepo = criarAnexoLeadRepoFake(1);

    const resultado = await moverLead(
      { leadId: "lead-1", novaEtapa: "negociacao" },
      { leadRepo: leadRepo as never, historicoRepo: historicoRepo as never, anexoLeadRepo: anexoLeadRepo as never }
    );

    expect(resultado.etapa).toBe("negociacao");
  });

  it("bloqueia comissão SEM anexo de ir pra negociação (troca a exigência de orçamento por anexo)", async () => {
    const leadRepo = criarLeadRepoFake(criarLeadFake({ etapa: "proposta", eh_comissao: true }));
    const historicoRepo = criarHistoricoRepoFake();
    const anexoLeadRepo = criarAnexoLeadRepoFake(0);

    await expect(
      moverLead(
        { leadId: "lead-1", novaEtapa: "negociacao" },
        { leadRepo: leadRepo as never, historicoRepo: historicoRepo as never, anexoLeadRepo: anexoLeadRepo as never }
      )
    ).rejects.toBeInstanceOf(ConflictError);
    expect(leadRepo.update).not.toHaveBeenCalled();
  });

  it("comissão sem anexoLeadRepo passado também bloqueia (trata como 0 anexos, não deixa passar)", async () => {
    const leadRepo = criarLeadRepoFake(criarLeadFake({ etapa: "proposta", eh_comissao: true }));
    const historicoRepo = criarHistoricoRepoFake();

    await expect(
      moverLead(
        { leadId: "lead-1", novaEtapa: "negociacao" },
        { leadRepo: leadRepo as never, historicoRepo: historicoRepo as never }
      )
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("fechar um lead de comissão gera um lançamento de receita com o valor da comissão", async () => {
    const leadRepo = criarLeadRepoFake(
      criarLeadFake({
        etapa: "negociacao",
        eh_comissao: true,
        valor_indicado: 10000,
        percentual_comissao: 15,
        valor_comissao: 1500,
        parceiro: { nome: "Parceiro X" } as never,
        cliente: { nome: "Cliente Y" } as never,
      })
    );
    const historicoRepo = criarHistoricoRepoFake();
    const lancamentoRepo = criarLancamentoRepoFake();

    await moverLead(
      { leadId: "lead-1", novaEtapa: "fechado" },
      { leadRepo: leadRepo as never, historicoRepo: historicoRepo as never, lancamentoRepo: lancamentoRepo as never }
    );

    expect(lancamentoRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: "receita",
        categoria: "Comissão Recebida",
        descricao: "Comissão - Parceiro X para Cliente Y",
        valor: 1500,
        pago: false,
        lead_id: "lead-1",
      })
    );
  });

  it("fechar um lead NORMAL (não comissão) não gera lançamento nenhum", async () => {
    const leadRepo = criarLeadRepoFake(criarLeadFake({ etapa: "negociacao", eh_comissao: false, orcamento_id: 42 }));
    const historicoRepo = criarHistoricoRepoFake();
    const lancamentoRepo = criarLancamentoRepoFake();

    await moverLead(
      { leadId: "lead-1", novaEtapa: "fechado" },
      { leadRepo: leadRepo as never, historicoRepo: historicoRepo as never, lancamentoRepo: lancamentoRepo as never }
    );

    expect(lancamentoRepo.create).not.toHaveBeenCalled();
  });

  it("falha ao gerar o lançamento de comissão não impede o lead de fechar (best-effort)", async () => {
    const leadRepo = criarLeadRepoFake(criarLeadFake({ etapa: "negociacao", eh_comissao: true, valor_comissao: 500 }));
    const historicoRepo = criarHistoricoRepoFake();
    const lancamentoRepo = { create: jest.fn(async () => { throw new Error("categoria removida"); }) };

    const resultado = await moverLead(
      { leadId: "lead-1", novaEtapa: "fechado" },
      { leadRepo: leadRepo as never, historicoRepo: historicoRepo as never, lancamentoRepo: lancamentoRepo as never }
    );

    expect(resultado.etapa).toBe("fechado");
  });
});
