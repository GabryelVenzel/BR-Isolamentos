import { ConflictError, NotFoundError } from "@/lib/errors";
import { atualizarCategoria, garantirHistoricoMesAtual, marcarCustoFixoPago, removerCategoria } from "@/lib/usecases/financeiro";
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

describe("marcarCustoFixoPago", () => {
  it("cria o lançamento de despesa e marca o histórico como pago", async () => {
    const custoFixoRepo = { findById: jest.fn(async () => custoFixo()) };
    const lancamentoRepo = { create: jest.fn(async (dados: Partial<LancamentoFinanceiro>) => ({ id: "l1", ...dados })) };
    const historicoRepo = {
      buscarPorMes: jest.fn(async () => null),
      create: jest.fn(async (dados: Partial<HistoricoCustoFixo>) => ({ id: "h1", ...dados })),
      update: jest.fn(),
    };

    const resultado = await marcarCustoFixoPago("cf1", {}, {
      custoFixoRepo: custoFixoRepo as never,
      lancamentoRepo: lancamentoRepo as never,
      historicoRepo: historicoRepo as never,
    });

    expect(lancamentoRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: "despesa", valor: 3000, pago: true })
    );
    expect(historicoRepo.create).toHaveBeenCalledWith(expect.objectContaining({ status: "pago", lancamento_id: "l1" }));
    expect(resultado.historico.status).toBe("pago");
  });

  it("atualiza (não recria) o histórico quando já existe uma linha pro mês", async () => {
    const custoFixoRepo = { findById: jest.fn(async () => custoFixo()) };
    const lancamentoRepo = { create: jest.fn(async (dados: Partial<LancamentoFinanceiro>) => ({ id: "l1", ...dados })) };
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
    const historicoRepo = {
      buscarPorMes: jest.fn(async () => existente),
      create: jest.fn(),
      update: jest.fn(async (_id: string, dados: Partial<HistoricoCustoFixo>) => ({ ...existente, ...dados })),
    };

    await marcarCustoFixoPago("cf1", {}, {
      custoFixoRepo: custoFixoRepo as never,
      lancamentoRepo: lancamentoRepo as never,
      historicoRepo: historicoRepo as never,
    });

    expect(historicoRepo.create).not.toHaveBeenCalled();
    expect(historicoRepo.update).toHaveBeenCalledWith("h1", expect.objectContaining({ status: "pago" }));
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
  it("cria histórico só pra custos ativos com dia_mes definido e sem linha ainda este mês", async () => {
    const custoFixoRepo = {
      listarTodos: jest.fn(async () => [
        custoFixo({ id: "1", ativo: true, dia_mes: 5 }),
        custoFixo({ id: "2", ativo: false, dia_mes: 10 }), // inativo, pulado
        custoFixo({ id: "3", ativo: true, dia_mes: null }), // sem dia_mes, pulado
      ]),
    };
    const historicoRepo = {
      buscarPorMes: jest.fn(async () => null),
      create: jest.fn(async (dados: unknown) => dados),
    };

    await garantirHistoricoMesAtual(
      { custoFixoRepo: custoFixoRepo as never, historicoRepo: historicoRepo as never },
      new Date(2026, 7, 1)
    );

    expect(historicoRepo.create).toHaveBeenCalledTimes(1);
    expect(historicoRepo.create).toHaveBeenCalledWith(expect.objectContaining({ custo_fixo_id: "1", status: "pendente" }));
  });

  it("não recria histórico que já existe pro mês", async () => {
    const custoFixoRepo = { listarTodos: jest.fn(async () => [custoFixo({ id: "1" })]) };
    const historicoRepo = {
      buscarPorMes: jest.fn(async () => ({ id: "h1" })),
      create: jest.fn(),
    };

    await garantirHistoricoMesAtual({ custoFixoRepo: custoFixoRepo as never, historicoRepo: historicoRepo as never });

    expect(historicoRepo.create).not.toHaveBeenCalled();
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
