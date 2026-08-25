import { ConflictError, ValidationError } from "@/lib/errors";
import { finalizarServico, moverServico } from "@/lib/usecases/operacional";
import type { Servico } from "@/lib/types/domain";

function servico(overrides: Partial<Servico> = {}): Servico {
  return {
    id: "s1",
    numero_servico: "S00001",
    lead_id: "l1",
    numero_lead: "L00001",
    orcamento_id: 1,
    numero_orcamento: "O00001",
    cliente_id: 1,
    etapa: "execucao",
    tipo_trabalho: "bancada",
    tipos_trabalho: ["bancada"],
    valor_orcado: 1000,
    valor_real: null,
    data_inicio: "2026-08-01",
    data_fim_prevista: "2026-08-10",
    data_fim_real: null,
    parceiro_principal_id: "p1",
    pessoas_alocadas: 5,
    parceiros_alocados: [],
    descricao: null,
    notas: null,
    foto_principal_url: null,
    fotos_url: [],
    pdf_relatorio_url: null,
    responsavel_email: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function criarServicoRepoFake(inicial: Servico) {
  let estado = inicial;
  return {
    findById: jest.fn(async () => estado),
    update: jest.fn(async (_id: string, dados: Partial<Servico>) => {
      estado = { ...estado, ...dados };
      return estado;
    }),
  };
}

function criarHistoricoRepoFake() {
  return { create: jest.fn(async (dados: unknown) => dados) };
}

describe("moverServico", () => {
  it("move livremente entre planejamento e execução", async () => {
    const servicoRepo = criarServicoRepoFake(servico({ etapa: "planejamento" }));
    const historicoRepo = criarHistoricoRepoFake();

    const resultado = await moverServico(
      { servicoId: "s1", novaEtapa: "execucao" },
      { servicoRepo: servicoRepo as never, historicoRepo: historicoRepo as never }
    );

    expect(resultado.etapa).toBe("execucao");
    expect(historicoRepo.create).toHaveBeenCalledWith(expect.objectContaining({ tipo_evento: "mudanca_etapa" }));
  });

  it("rejeita mover direto pra 'finalizado' — precisa passar pelo checklist", async () => {
    const servicoRepo = criarServicoRepoFake(servico({ etapa: "execucao" }));
    const historicoRepo = criarHistoricoRepoFake();

    await expect(
      moverServico(
        { servicoId: "s1", novaEtapa: "finalizado" },
        { servicoRepo: servicoRepo as never, historicoRepo: historicoRepo as never }
      )
    ).rejects.toBeInstanceOf(ConflictError);
    expect(servicoRepo.update).not.toHaveBeenCalled();
  });

  it("rejeita mover um serviço já finalizado (não reabre)", async () => {
    const servicoRepo = criarServicoRepoFake(servico({ etapa: "finalizado" }));
    const historicoRepo = criarHistoricoRepoFake();

    await expect(
      moverServico(
        { servicoId: "s1", novaEtapa: "planejamento" },
        { servicoRepo: servicoRepo as never, historicoRepo: historicoRepo as never }
      )
    ).rejects.toBeInstanceOf(ConflictError);
  });
});

describe("finalizarServico", () => {
  it("rejeita finalizar sem foto principal e PDF anexados", async () => {
    const servicoRepo = criarServicoRepoFake(servico({ foto_principal_url: null, pdf_relatorio_url: null }));
    const historicoRepo = criarHistoricoRepoFake();

    await expect(
      finalizarServico("s1", { valor_real: 1000 }, { servicoRepo: servicoRepo as never, historicoRepo: historicoRepo as never })
    ).rejects.toBeInstanceOf(ValidationError);
    expect(servicoRepo.update).not.toHaveBeenCalled();
  });

  it("rejeita finalizar sem valor_real no corpo", async () => {
    const servicoRepo = criarServicoRepoFake(
      servico({ foto_principal_url: "foto.jpg", pdf_relatorio_url: "relatorio.pdf" })
    );
    const historicoRepo = criarHistoricoRepoFake();

    await expect(
      finalizarServico("s1", {}, { servicoRepo: servicoRepo as never, historicoRepo: historicoRepo as never })
    ).rejects.toThrow();
  });

  it("finaliza quando todos os requisitos estão prontos", async () => {
    const servicoRepo = criarServicoRepoFake(
      servico({ foto_principal_url: "foto.jpg", pdf_relatorio_url: "relatorio.pdf" })
    );
    const historicoRepo = criarHistoricoRepoFake();

    const resultado = await finalizarServico(
      "s1",
      { valor_real: 1050 },
      { servicoRepo: servicoRepo as never, historicoRepo: historicoRepo as never },
      "socio@brisolamentos.com"
    );

    expect(resultado.etapa).toBe("finalizado");
    expect(resultado.valor_real).toBe(1050);
    expect(resultado.data_fim_real).not.toBeNull();
    expect(historicoRepo.create).toHaveBeenCalledWith(expect.objectContaining({ tipo_evento: "finalizacao" }));
  });

  it("cria um lançamento de receita pendente vinculado ao serviço (integração com o Financeiro)", async () => {
    const servicoRepo = criarServicoRepoFake(
      servico({ numero_servico: "S00042", foto_principal_url: "foto.jpg", pdf_relatorio_url: "relatorio.pdf", orcamento_id: 7 })
    );
    const historicoRepo = criarHistoricoRepoFake();
    const lancamentoRepo = { create: jest.fn(async (dados: unknown) => dados) };

    await finalizarServico(
      "s1",
      { valor_real: 5000 },
      { servicoRepo: servicoRepo as never, historicoRepo: historicoRepo as never, lancamentoRepo: lancamentoRepo as never }
    );

    expect(lancamentoRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: "receita", valor: 5000, pago: false, servico_id: "s1", orcamento_id: 7 })
    );
  });

  it("não quebra se lancamentoRepo não for passado (compatibilidade)", async () => {
    const servicoRepo = criarServicoRepoFake(servico({ foto_principal_url: "foto.jpg", pdf_relatorio_url: "relatorio.pdf" }));
    const historicoRepo = criarHistoricoRepoFake();

    const resultado = await finalizarServico(
      "s1",
      { valor_real: 1000 },
      { servicoRepo: servicoRepo as never, historicoRepo: historicoRepo as never }
    );
    expect(resultado.etapa).toBe("finalizado");
  });

  it("rejeita finalizar um serviço já finalizado", async () => {
    const servicoRepo = criarServicoRepoFake(
      servico({ etapa: "finalizado", foto_principal_url: "foto.jpg", pdf_relatorio_url: "relatorio.pdf" })
    );
    const historicoRepo = criarHistoricoRepoFake();

    await expect(
      finalizarServico("s1", { valor_real: 1000 }, { servicoRepo: servicoRepo as never, historicoRepo: historicoRepo as never })
    ).rejects.toBeInstanceOf(ConflictError);
  });
});
