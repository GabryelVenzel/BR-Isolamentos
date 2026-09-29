import { projecaoCaixa } from "@/lib/usecases/resumo/projecaoCaixa";
import type { CustoFixo, LancamentoFinanceiro } from "@/lib/types/domain";

// Bug relatado (efeito colateral da funcionalidade "custo fixo vira
// lançamento 'a pagar' automático", ver garantirHistoricoMesAtual.ts):
// projecaoCaixa somava, TODO dia, 1/30 do total de TODOS os custos fixos
// ativos — depois que um custo fixo com `dia_mes` passou a ter um lançamento
// de verdade com data certa, esse mesmo custo contava 2x (no dia certo, via
// lançamento; "borrifado" nos 30 dias, via a média). Só custos SEM `dia_mes`
// (que não têm lançamento com data pra cair em lugar nenhum) devem continuar
// usando a média diária.

function lancamento(overrides: Partial<LancamentoFinanceiro> = {}): LancamentoFinanceiro {
  return {
    id: "l1",
    tipo: "despesa",
    categoria: "Custo fixo",
    data: "2026-08-01",
    descricao: "Aluguel",
    valor: 3000,
    pago: false,
    data_pagamento: null,
    orcamento_id: null,
    arquivo_url: null,
    anexos: [],
    servico_id: null,
    lead_id: null,
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

function custoFixo(overrides: Partial<CustoFixo> = {}): CustoFixo {
  return {
    id: "cf1",
    categoria: "Custo fixo",
    descricao: "Aluguel",
    valor_mensal: 3000,
    dia_mes: 10,
    notas: null,
    ativo: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("projecaoCaixa", () => {
  it("custo fixo COM dia_mes: conta só 1x (via o lançamento real na data certa), não também na média diária", async () => {
    const hoje = new Date();
    const daqui5Dias = new Date(hoje);
    daqui5Dias.setDate(daqui5Dias.getDate() + 5);
    const dataISO = daqui5Dias.toISOString().slice(0, 10);

    const lancamentoRepo = { listar: jest.fn(async () => [lancamento({ data: dataISO, valor: 3000 })]) };
    const custoFixoRepo = { listarTodos: jest.fn(async () => [custoFixo({ dia_mes: 10, valor_mensal: 3000 })]) };

    const resultado = await projecaoCaixa(lancamentoRepo as never, custoFixoRepo as never);

    const diaDoVencimento = resultado.dias.find((d) => d.data === dataISO)!;
    const diaAntes = resultado.dias[resultado.dias.findIndex((d) => d.data === dataISO) - 1];
    // Só a queda do lançamento (3000) nesse dia — nenhuma média diária somada junto.
    expect(diaAntes.saldoProjetado - diaDoVencimento.saldoProjetado).toBe(3000);
  });

  it("custo fixo SEM dia_mes: distribui em média diária (1/30), não some da projeção", async () => {
    const lancamentoRepo = { listar: jest.fn(async () => []) };
    const custoFixoRepo = { listarTodos: jest.fn(async () => [custoFixo({ dia_mes: null, valor_mensal: 3000 })]) };

    const resultado = await projecaoCaixa(lancamentoRepo as never, custoFixoRepo as never);

    const quedaPorDia = resultado.dias[0].saldoProjetado - resultado.dias[1].saldoProjetado;
    expect(quedaPorDia).toBeCloseTo(3000 / 30, 5);
  });
});
