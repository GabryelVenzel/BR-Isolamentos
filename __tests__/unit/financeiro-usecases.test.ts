import { ConflictError, NotFoundError } from "@/lib/errors";
import { atualizarCategoria, garantirHistoricoMesAtual, marcarComoPago, marcarCustoFixoPago, removerCategoria } from "@/lib/usecases/financeiro";
import type { CategoriaLancamento, CustoFixo, HistoricoCustoFixo, LancamentoFinanceiro } from "@/lib/types/domain";

function custoFixo(overrides: Partial<CustoFixo> = {}): CustoFixo {
  return {
    id: "cf1",
    categoria: "Custo fixo",
    descricao: "Aluguel",
    valor_mensal: 3000,
    dia_mes: 5,
    notas: null,
    ativo: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function categoria(overrides: Partial<CategoriaLancamento> = {}): CategoriaLancamento {
  return {
    id: "c1",
    nome: "Custo fixo",
    descricao: null,
    tipo: "despesa",
    cor: null,
    ativo: true,
    protegida: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

// Pedido explícito: o custo fixo deve contar no fluxo de caixa (aba
// Lançamentos) assim que "vence", como despesa "a pagar" (`pago: false`, sem
// anexo) — não só quando o usuário confirma que já pagou. Por isso
// `garantirHistoricoMesAtual`/`garantirLancamentoDoMes` agora criam histórico
// E lançamento juntos, e `marcarCustoFixoPago` passou a ATUALIZAR esse
// lançamento (nunca criar um 2º) — ver comentários nos próprios arquivos.
describe("marcarCustoFixoPago", () => {
  it("mês novo (sem histórico ainda): cria o lançamento 'a pagar' e já o marca como pago", async () => {
    const custoFixoRepo = { findById: jest.fn(async () => custoFixo()) };
    const lancamentoRepo = {
      create: jest.fn(async (dados: Partial<LancamentoFinanceiro>) => ({ id: "l1", pago: false, ...dados })),
      update: jest.fn(async (id: string, dados: Partial<LancamentoFinanceiro>) => ({ id, pago: false, ...dados })),
      findById: jest.fn(),
    };
    const historicoRepo = {
      buscarPorMes: jest.fn(async () => null),
      create: jest.fn(async (dados: Partial<HistoricoCustoFixo>) => ({ id: "h1", ...dados })),
      update: jest.fn(async (id: string, dados: Partial<HistoricoCustoFixo>) => ({ id, ...dados })),
    };

    const resultado = await marcarCustoFixoPago("cf1", {}, {
      custoFixoRepo: custoFixoRepo as never,
      lancamentoRepo: lancamentoRepo as never,
      historicoRepo: historicoRepo as never,
    });

    // Nasce "a pagar", sem anexo — só get vira `pago: true` na atualização seguinte.
    expect(lancamentoRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: "despesa", valor: 3000, pago: false })
    );
    expect(historicoRepo.create).toHaveBeenCalledWith(expect.objectContaining({ status: "pendente", lancamento_id: "l1" }));
    expect(lancamentoRepo.update).toHaveBeenCalledWith("l1", expect.objectContaining({ pago: true }));
    expect(historicoRepo.update).toHaveBeenCalledWith("h1", expect.objectContaining({ status: "pago" }));
    expect(resultado.historico.status).toBe("pago");
    expect(resultado.lancamento.pago).toBe(true);
  });

  it("mês com sweep já rodado (histórico + lançamento 'a pagar' já existem): atualiza, não duplica", async () => {
    const custoFixoRepo = { findById: jest.fn(async () => custoFixo()) };
    const existente: HistoricoCustoFixo = {
      id: "h1",
      custo_fixo_id: "cf1",
      data_prevista: "2026-08-05",
      data_pagamento: null,
      valor: 3000,
      status: "pendente",
      lancamento_id: "l1",
      created_at: "2026-08-01T00:00:00Z",
    };
    const lancamentoPendente = { id: "l1", tipo: "despesa", valor: 3000, pago: false } as LancamentoFinanceiro;
    const lancamentoRepo = {
      create: jest.fn(),
      findById: jest.fn(async () => lancamentoPendente),
      update: jest.fn(async (id: string, dados: Partial<LancamentoFinanceiro>) => ({ ...lancamentoPendente, id, ...dados })),
    };
    const historicoRepo = {
      buscarPorMes: jest.fn(async () => existente),
      create: jest.fn(),
      update: jest.fn(async (id: string, dados: Partial<HistoricoCustoFixo>) => ({ ...existente, id, ...dados })),
    };

    await marcarCustoFixoPago("cf1", {}, {
      custoFixoRepo: custoFixoRepo as never,
      lancamentoRepo: lancamentoRepo as never,
      historicoRepo: historicoRepo as never,
    });

    expect(lancamentoRepo.create).not.toHaveBeenCalled();
    expect(historicoRepo.create).not.toHaveBeenCalled();
    expect(lancamentoRepo.findById).toHaveBeenCalledWith("l1");
    expect(lancamentoRepo.update).toHaveBeenCalledWith("l1", expect.objectContaining({ pago: true }));
    expect(historicoRepo.update).toHaveBeenCalledWith("h1", expect.objectContaining({ status: "pago" }));
  });

  it("histórico antigo sem lancamento_id (dado de antes desta funcionalidade): cria o lançamento e linka", async () => {
    const custoFixoRepo = { findById: jest.fn(async () => custoFixo()) };
    const existente: HistoricoCustoFixo = {
      id: "h1",
      custo_fixo_id: "cf1",
      data_prevista: "2026-08-05",
      data_pagamento: null,
      valor: 3000,
      status: "pendente",
      lancamento_id: null,
      created_at: "2026-08-01T00:00:00Z",
    };
    const lancamentoRepo = {
      create: jest.fn(async (dados: Partial<LancamentoFinanceiro>) => ({ id: "l1", pago: false, ...dados })),
      findById: jest.fn(),
      update: jest.fn(async (id: string, dados: Partial<LancamentoFinanceiro>) => ({ id, pago: false, ...dados })),
    };
    const historicoRepo = {
      buscarPorMes: jest.fn(async () => existente),
      create: jest.fn(),
      update: jest.fn(async (id: string, dados: Partial<HistoricoCustoFixo>) => ({ ...existente, id, ...dados })),
    };

    await marcarCustoFixoPago("cf1", {}, {
      custoFixoRepo: custoFixoRepo as never,
      lancamentoRepo: lancamentoRepo as never,
      historicoRepo: historicoRepo as never,
    });

    expect(lancamentoRepo.create).toHaveBeenCalledTimes(1);
    expect(historicoRepo.create).not.toHaveBeenCalled();
    // 1ª chamada linka o lançamento novo; a última marca como pago.
    expect(historicoRepo.update).toHaveBeenNthCalledWith(1, "h1", expect.objectContaining({ lancamento_id: "l1" }));
    expect(historicoRepo.update).toHaveBeenLastCalledWith("h1", expect.objectContaining({ status: "pago" }));
  });

  it("lança NotFoundError se o custo fixo não existe", async () => {
    const custoFixoRepo = { findById: jest.fn(async () => null) };
    await expect(
      marcarCustoFixoPago("inexistente", {}, {
        custoFixoRepo: custoFixoRepo as never,
        lancamentoRepo: { create: jest.fn() } as never,
        historicoRepo: { buscarPorMes: jest.fn(), create: jest.fn(), update: jest.fn() } as never,
      })
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("garantirHistoricoMesAtual", () => {
  it("cria histórico E lançamento 'a pagar' só pra custos ativos com dia_mes definido e sem linha ainda este mês", async () => {
    const custoFixoRepo = {
      listarTodos: jest.fn(async () => [
        custoFixo({ id: "1", ativo: true, dia_mes: 5 }),
        custoFixo({ id: "2", ativo: false, dia_mes: 10 }), // inativo, pulado
        custoFixo({ id: "3", ativo: true, dia_mes: null }), // sem dia_mes, pulado
      ]),
    };
    const lancamentoRepo = {
      create: jest.fn(async (dados: Partial<LancamentoFinanceiro>) => ({ id: "l1", ...dados })),
      findById: jest.fn(),
    };
    const historicoRepo = {
      buscarPorMes: jest.fn(async () => null),
      create: jest.fn(async (dados: unknown) => dados),
      update: jest.fn(),
    };

    await garantirHistoricoMesAtual(
      { custoFixoRepo: custoFixoRepo as never, lancamentoRepo: lancamentoRepo as never, historicoRepo: historicoRepo as never },
      new Date(2026, 7, 1)
    );

    expect(lancamentoRepo.create).toHaveBeenCalledTimes(1);
    expect(lancamentoRepo.create).toHaveBeenCalledWith(expect.objectContaining({ tipo: "despesa", pago: false }));
    expect(historicoRepo.create).toHaveBeenCalledTimes(1);
    expect(historicoRepo.create).toHaveBeenCalledWith(expect.objectContaining({ custo_fixo_id: "1", status: "pendente", lancamento_id: "l1" }));
  });

  it("não recria histórico/lançamento que já existem (e já estão linkados) pro mês", async () => {
    const custoFixoRepo = { listarTodos: jest.fn(async () => [custoFixo({ id: "1" })]) };
    const lancamentoRepo = { create: jest.fn(), findById: jest.fn(async () => ({ id: "l1" })) };
    const historicoRepo = {
      buscarPorMes: jest.fn(async () => ({ id: "h1", lancamento_id: "l1" })),
      create: jest.fn(),
      update: jest.fn(),
    };

    await garantirHistoricoMesAtual({
      custoFixoRepo: custoFixoRepo as never,
      lancamentoRepo: lancamentoRepo as never,
      historicoRepo: historicoRepo as never,
    });

    expect(historicoRepo.create).not.toHaveBeenCalled();
    expect(lancamentoRepo.create).not.toHaveBeenCalled();
  });
});

describe("marcarComoPago (lançamento genérico)", () => {
  it("marca como pago e, se o lançamento vier de um custo fixo, sincroniza o histórico junto", async () => {
    const lancamentoRepo = {
      findById: jest.fn(async () => ({ id: "l1", pago: false } as LancamentoFinanceiro)),
      update: jest.fn(async (id: string, dados: Partial<LancamentoFinanceiro>) => ({ id, ...dados })),
    };
    const historicoRepo = {
      buscarPorLancamentoId: jest.fn(async () => ({ id: "h1", status: "pendente" } as HistoricoCustoFixo)),
      update: jest.fn(async (id: string, dados: Partial<HistoricoCustoFixo>) => ({ id, ...dados })),
    };

    const resultado = await marcarComoPago("l1", "2026-08-05", {
      lancamentoRepo: lancamentoRepo as never,
      historicoRepo: historicoRepo as never,
    });

    expect(lancamentoRepo.update).toHaveBeenCalledWith("l1", expect.objectContaining({ pago: true, data_pagamento: "2026-08-05" }));
    expect(historicoRepo.update).toHaveBeenCalledWith("h1", expect.objectContaining({ status: "pago", data_pagamento: "2026-08-05" }));
    expect(resultado.pago).toBe(true);
  });

  it("lançamento avulso (não vem de custo fixo): não mexe em histórico nenhum", async () => {
    const lancamentoRepo = {
      findById: jest.fn(async () => ({ id: "l2", pago: false } as LancamentoFinanceiro)),
      update: jest.fn(async (id: string, dados: Partial<LancamentoFinanceiro>) => ({ id, ...dados })),
    };
    const historicoRepo = { buscarPorLancamentoId: jest.fn(async () => null), update: jest.fn() };

    await marcarComoPago("l2", undefined, { lancamentoRepo: lancamentoRepo as never, historicoRepo: historicoRepo as never });

    expect(historicoRepo.update).not.toHaveBeenCalled();
  });

  it("lança NotFoundError se o lançamento não existe", async () => {
    const lancamentoRepo = { findById: jest.fn(async () => null), update: jest.fn() };
    await expect(marcarComoPago("inexistente", undefined, { lancamentoRepo: lancamentoRepo as never })).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("atualizarCategoria", () => {
  it("bloqueia renomear categoria protegida", async () => {
    const categoriaRepo = { findById: jest.fn(async () => categoria({ protegida: true, nome: "Salário" })) };
    await expect(
      atualizarCategoria("c1", { nome: "Novo nome" }, { categoriaRepo: categoriaRepo as never })
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("permite desativar categoria protegida (não é renomear)", async () => {
    const categoriaRepo = {
      findById: jest.fn(async () => categoria({ protegida: true })),
      update: jest.fn(async (_id: string, dados: unknown) => ({ ...categoria(), ...(dados as object) })),
    };
    const resultado = await atualizarCategoria("c1", { ativo: false }, { categoriaRepo: categoriaRepo as never });
    expect(resultado.ativo).toBe(false);
  });
});

describe("removerCategoria", () => {
  it("bloqueia excluir categoria protegida", async () => {
    const categoriaRepo = { findById: jest.fn(async () => categoria({ protegida: true })) };
    await expect(removerCategoria("c1", { categoriaRepo: categoriaRepo as never })).rejects.toBeInstanceOf(ConflictError);
  });

  it("bloqueia excluir categoria com lançamentos vinculados", async () => {
    const categoriaRepo = {
      findById: jest.fn(async () => categoria({ protegida: false, nome: "Categoria Custom" })),
      contarLancamentosComCategoria: jest.fn(async () => 3),
    };
    await expect(removerCategoria("c1", { categoriaRepo: categoriaRepo as never })).rejects.toBeInstanceOf(ConflictError);
  });

  it("permite excluir categoria não protegida e sem lançamentos", async () => {
    const categoriaRepo = {
      findById: jest.fn(async () => categoria({ protegida: false })),
      contarLancamentosComCategoria: jest.fn(async () => 0),
      delete: jest.fn(async () => undefined),
    };
    await removerCategoria("c1", { categoriaRepo: categoriaRepo as never });
    expect(categoriaRepo.delete).toHaveBeenCalledWith("c1");
  });
});
