import {
  calcularAlertas,
  calcularCustosFixosVsVariaveis,
  calcularDistribuicaoPorCategoria,
  calcularKpisFinanceiro,
  calcularReceitaVsDespesaPorMes,
} from "@/lib/usecases/financeiro";
import type { LancamentoFinanceiro } from "@/lib/types/domain";

function lancamento(overrides: Partial<LancamentoFinanceiro> = {}): LancamentoFinanceiro {
  return {
    id: "l1",
    tipo: "despesa",
    categoria: "Outra despesa",
    data: "2026-08-10",
    descricao: "Teste",
    valor: 1000,
    pago: true,
    data_pagamento: "2026-08-10",
    orcamento_id: null,
    arquivo_url: null,
    anexos: [],
    servico_id: null,
    lead_id: null,
    created_at: "2026-08-10T00:00:00Z",
    updated_at: "2026-08-10T00:00:00Z",
    ...overrides,
  };
}

describe("calcularKpisFinanceiro", () => {
  it("soma receita/despesa e calcula lucro líquido e margem", () => {
    const lancamentos = [
      lancamento({ id: "1", tipo: "receita", valor: 10000 }),
      lancamento({ id: "2", tipo: "despesa", valor: 6000 }),
    ];
    const kpis = calcularKpisFinanceiro(lancamentos, 500);
    expect(kpis.receitaTotal).toBe(10000);
    expect(kpis.despesaTotal).toBe(6000);
    expect(kpis.lucroLiquido).toBe(4000);
    expect(kpis.custosFixosMensal).toBe(500);
    expect(kpis.margemPercentual).toBeCloseTo(40, 5);
  });

  it("margem é null sem nenhuma receita (evita divisão por zero)", () => {
    const kpis = calcularKpisFinanceiro([lancamento({ tipo: "despesa", valor: 100 })], 0);
    expect(kpis.margemPercentual).toBeNull();
  });
});

describe("calcularDistribuicaoPorCategoria", () => {
  it("agrupa por categoria e calcula percentual, só do tipo pedido", () => {
    const lancamentos = [
      lancamento({ id: "1", tipo: "despesa", categoria: "Salário", valor: 8000 }),
      lancamento({ id: "2", tipo: "despesa", categoria: "Custo fixo", valor: 2000 }),
      lancamento({ id: "3", tipo: "receita", categoria: "Venda de orçamento/serviço", valor: 50000 }),
    ];
    const distribuicao = calcularDistribuicaoPorCategoria(lancamentos, "despesa");
    expect(distribuicao).toHaveLength(2);
    expect(distribuicao[0]).toEqual({ categoria: "Salário", valor: 8000, percentual: 80 });
    expect(distribuicao[1]).toEqual({ categoria: "Custo fixo", valor: 2000, percentual: 20 });
  });
});

describe("calcularCustosFixosVsVariaveis", () => {
  it("separa despesas categoria 'Custo fixo' do resto", () => {
    const lancamentos = [
      lancamento({ id: "1", tipo: "despesa", categoria: "Custo fixo", valor: 3500 }),
      lancamento({ id: "2", tipo: "despesa", categoria: "Compra de material", valor: 15000 }),
      lancamento({ id: "3", tipo: "receita", valor: 50000 }), // ignorado, é receita
    ];
    const resultado = calcularCustosFixosVsVariaveis(lancamentos);
    expect(resultado.fixos).toBe(3500);
    expect(resultado.variaveis).toBe(15000);
    expect(resultado.totalDespesa).toBe(18500);
  });
});

describe("calcularReceitaVsDespesaPorMes", () => {
  it("agrupa por mês (YYYY-MM) e ordena cronologicamente", () => {
    const lancamentos = [
      lancamento({ id: "1", tipo: "receita", data: "2026-08-05", valor: 10000 }),
      lancamento({ id: "2", tipo: "despesa", data: "2026-08-20", valor: 3000 }),
      lancamento({ id: "3", tipo: "receita", data: "2026-07-01", valor: 5000 }),
    ];
    const resultado = calcularReceitaVsDespesaPorMes(lancamentos);
    expect(resultado.map((r) => r.mes)).toEqual(["2026-07", "2026-08"]);
    expect(resultado[1]).toEqual({ mes: "2026-08", receita: 10000, despesa: 3000, lucro: 7000 });
  });
});

describe("calcularAlertas", () => {
  it("gera alertas separados para receita e despesa pendente", () => {
    const pendentes = [
      lancamento({ id: "1", tipo: "receita", pago: false, valor: 25000 }),
      lancamento({ id: "2", tipo: "despesa", pago: false, valor: 5000 }),
    ];
    const alertas = calcularAlertas(pendentes);
    expect(alertas).toHaveLength(2);
    expect(alertas.find((a) => a.tipo === "receita_pendente")?.valor).toBe(25000);
    expect(alertas.find((a) => a.tipo === "despesa_pendente")?.valor).toBe(5000);
  });

  it("sem pendências, não gera nenhum alerta", () => {
    expect(calcularAlertas([])).toHaveLength(0);
  });
});
