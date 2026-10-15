import { calcularFluxoCaixa, type EntradaFluxoCaixa } from "@/lib/usecases/resumo/fluxoCaixa";

type L = EntradaFluxoCaixa["lancamentos"][number];
const lanc = (o: Partial<L>): L => ({ tipo: "despesa", valor: 100, data: "2026-10-14", pago: false, data_pagamento: null, descricao: "x", categoria: "c", ...o });

const base = (o: Partial<EntradaFluxoCaixa> = {}): EntradaFluxoCaixa => ({
  lancamentos: [],
  custosFixos: [],
  saldoInicial: 0,
  dataInicial: "2026-09-28",
  hoje: "2026-10-14",
  ...o,
});

describe("calcularFluxoCaixa", () => {
  it("saldo de hoje = saldo inicial + pagos desde a data inicial, pela data do pagamento", () => {
    const r = calcularFluxoCaixa(
      base({
        saldoInicial: 1000,
        lancamentos: [
          lanc({ tipo: "receita", valor: 500, pago: true, data: "2026-10-01", data_pagamento: "2026-10-02" }),
          lanc({ tipo: "despesa", valor: 200, pago: true, data: "2026-10-05", data_pagamento: "2026-10-05" }),
          lanc({ tipo: "receita", valor: 999, pago: true, data: "2026-09-01", data_pagamento: "2026-09-01" }), // antes do início
          lanc({ tipo: "receita", valor: 50, pago: false, data: "2026-10-20" }), // em aberto
        ],
      })
    );
    expect(r.saldoHoje).toBe(1300);
  });

  it("conservador: a pagar vencido sai hoje; a receber vencido não entra (vira risco)", () => {
    const r = calcularFluxoCaixa(
      base({
        saldoInicial: 1000,
        lancamentos: [lanc({ tipo: "despesa", valor: 300, data: "2026-10-01" }), lanc({ tipo: "receita", valor: 400, data: "2026-10-02" })],
      })
    );
    expect(r.diario[0].saldo).toBe(700);
    expect(r.aPagarVencido).toEqual({ valor: 300, quantidade: 1 });
    expect(r.aReceberVencido).toEqual({ valor: 400, quantidade: 1 });
    expect(r.diario[r.diario.length - 1].saldo).toBe(700);
  });

  it("previstos entram no vencimento e acusam o primeiro dia negativo", () => {
    const r = calcularFluxoCaixa(
      base({ saldoInicial: 100, lancamentos: [lanc({ tipo: "despesa", valor: 150, data: "2026-10-20" }), lanc({ tipo: "receita", valor: 100, data: "2026-10-25" })] })
    );
    expect(r.primeiroDiaNegativo).toBe("2026-10-20");
    expect(r.menorSaldo).toEqual({ valor: -50, data: "2026-10-20" });
    expect(r.saldoEm.d30).toBe(50);
  });

  it("custo fixo com dia do mês entra nos meses seguintes sem duplicar o do mês atual", () => {
    const r = calcularFluxoCaixa(
      base({
        saldoInicial: 1000,
        custosFixos: [{ ativo: true, valor_mensal: 100, dia_mes: 20, descricao: "Aluguel", categoria: "Fixo" }],
        lancamentos: [lanc({ tipo: "despesa", valor: 100, data: "2026-10-20", descricao: "Aluguel", categoria: "Fixo" })],
      })
    );
    // out (lançamento existente) + nov + dez (dentro de 90 dias: até 12/01)
    expect(r.diario.filter((p) => p.saidas > 0).map((p) => p.data)).toEqual(["2026-10-20", "2026-11-20", "2026-12-20"]);
    expect(r.saldoEm.d90).toBe(700);
  });

  it("meses: passado realizado, atual e futuros previstos, com saldo acumulado", () => {
    const r = calcularFluxoCaixa(
      base({
        lancamentos: [
          lanc({ tipo: "receita", valor: 1000, pago: true, data: "2026-09-29", data_pagamento: "2026-09-29" }),
          lanc({ tipo: "despesa", valor: 200, pago: true, data: "2026-10-03", data_pagamento: "2026-10-03" }),
          lanc({ tipo: "receita", valor: 300, data: "2026-11-10" }),
        ],
      })
    );
    const set = r.meses.find((m) => m.mes === "2026-09")!;
    const out = r.meses.find((m) => m.mes === "2026-10")!;
    const nov = r.meses.find((m) => m.mes === "2026-11")!;
    expect(set).toMatchObject({ situacao: "passado", entradasRealizadas: 1000, saldoFinal: 1000 });
    expect(out).toMatchObject({ situacao: "atual", saidasRealizadas: 200, saldoFinal: 800 });
    expect(nov).toMatchObject({ situacao: "futuro", entradasPrevistas: 300, saldoFinal: 1100 });
  });

  it("aging separa vencidos e a vencer por faixa", () => {
    const r = calcularFluxoCaixa(
      base({ lancamentos: [lanc({ tipo: "receita", valor: 10, data: "2026-08-01" }), lanc({ tipo: "despesa", valor: 20, data: "2026-10-30" })] })
    );
    expect(r.aging[0]).toMatchObject({ aReceber: 10 });
    expect(r.aging[2]).toMatchObject({ aPagar: 20 });
  });

  it("visão por mês vai 4 meses à frente do atual, mesmo além dos 90 dias", () => {
    const r = calcularFluxoCaixa(
      base({
        custosFixos: [{ ativo: true, valor_mensal: 100, dia_mes: 20, descricao: "Aluguel", categoria: "Fixo" }],
        lancamentos: [lanc({ tipo: "receita", valor: 500, data: "2027-02-10" })],
      })
    );
    expect(r.meses.map((m) => m.mes)).toEqual(["2026-09", "2026-10", "2026-11", "2026-12", "2027-01", "2027-02"]);
    const fev = r.meses.at(-1)!;
    expect(fev).toMatchObject({ entradasPrevistas: 500, saidasPrevistas: 100 });
    // a visão diária continua com 90 dias
    expect(r.diario).toHaveLength(91);
    expect(r.diario.at(-1)!.data).toBe("2027-01-12");
  });

  it("semanas começam na segunda da semana de hoje", () => {
    const r = calcularFluxoCaixa(base());
    expect(r.semanas[0].inicio).toBe("2026-10-12");
    expect(r.semanas).toHaveLength(8);
  });
});
