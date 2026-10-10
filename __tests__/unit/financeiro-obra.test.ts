import { gerarParcelas, gerarRecorrencia, labelSituacao, situacaoLancamento, somarMeses, totaisLancamentos } from "@/lib/financeiro";
import { calcularDre, calcularResultadoObra, mesesDoIntervalo } from "@/lib/usecases/financeiro";
import type { Servico } from "@/lib/types/domain";

describe("somarMeses", () => {
  it("mantém o dia e vira o ano", () => {
    expect(somarMeses("2026-10-15", 1)).toBe("2026-11-15");
    expect(somarMeses("2026-10-15", 3)).toBe("2027-01-15");
    expect(somarMeses("2026-10-15", -10)).toBe("2025-12-15");
  });

  it("usa o último dia quando o mês de destino é mais curto", () => {
    expect(somarMeses("2026-01-31", 1)).toBe("2026-02-28");
    expect(somarMeses("2028-01-31", 1)).toBe("2028-02-29");
    expect(somarMeses("2026-08-31", 1)).toBe("2026-09-30");
  });
});

describe("situação do lançamento", () => {
  const hoje = "2026-10-09";
  it("classifica pelo vencimento", () => {
    expect(situacaoLancamento({ pago: true, data: "2026-01-01" }, hoje)).toBe("pago");
    expect(situacaoLancamento({ pago: false, data: "2026-10-08" }, hoje)).toBe("vencido");
    expect(situacaoLancamento({ pago: false, data: "2026-10-09" }, hoje)).toBe("vence_hoje");
    expect(situacaoLancamento({ pago: false, data: "2026-10-10" }, hoje)).toBe("a_vencer");
  });

  it("rótulo de pago depende do tipo", () => {
    expect(labelSituacao("pago", "receita")).toBe("Recebido");
    expect(labelSituacao("pago", "despesa")).toBe("Pago");
    expect(labelSituacao("vencido", "receita")).toBe("Vencido");
  });
});

describe("parcelas e recorrência", () => {
  const base = { descricao: "Chapa", valor: 100, data: "2026-10-31", data_competencia: "2026-10-01" };

  it("parcelado: divide o valor, soma fecha exata e a sobra vai pra última", () => {
    const parcelas = gerarParcelas(base, 3);
    expect(parcelas.map((p) => p.valor)).toEqual([33.33, 33.33, 33.34]);
    expect(parcelas.reduce((s, p) => s + Math.round(p.valor * 100), 0)).toBe(10000);
    expect(parcelas.map((p) => p.data)).toEqual(["2026-10-31", "2026-11-30", "2026-12-31"]);
    // A competência não anda: a compra aconteceu de uma vez.
    expect(parcelas.every((p) => p.data_competencia === "2026-10-01")).toBe(true);
    expect(parcelas.map((p) => p.descricao)).toEqual(["Chapa (1/3)", "Chapa (2/3)", "Chapa (3/3)"]);
    expect(parcelas[2]).toMatchObject({ parcela_numero: 3, parcela_total: 3 });
  });

  it("recorrente: valor cheio todo mês, competência acompanha", () => {
    const meses = gerarRecorrencia(base, 3);
    expect(meses.map((p) => p.valor)).toEqual([100, 100, 100]);
    expect(meses.map((p) => p.data_competencia)).toEqual(["2026-10-01", "2026-11-01", "2026-12-01"]);
    expect(meses.map((p) => p.descricao)).toEqual(["Chapa (1/3)", "Chapa (2/3)", "Chapa (3/3)"]);
  });
});

describe("totaisLancamentos", () => {
  it("separa em aberto, vencido e realizado", () => {
    const totais = totaisLancamentos(
      [
        { tipo: "receita", valor: 1000, pago: true, data: "2026-10-01" },
        { tipo: "receita", valor: 500, pago: false, data: "2026-10-05" }, // vencida
        { tipo: "receita", valor: 300, pago: false, data: "2026-10-20" },
        { tipo: "despesa", valor: 200, pago: true, data: "2026-10-02" },
        { tipo: "despesa", valor: 150, pago: false, data: "2026-10-01" }, // vencida
        { tipo: "despesa", valor: 50, pago: false, data: "2026-10-09" }, // vence hoje: não é vencida
      ],
      "2026-10-09"
    );
    expect(totais).toEqual({
      aReceber: 800,
      aPagar: 200,
      vencidoAReceber: 500,
      vencidoAPagar: 150,
      recebido: 1000,
      pago: 200,
      saldoPrevisto: 1800 - 400,
    });
  });
});

describe("resultado por obra", () => {
  const servico = { id: "s1", numero_servico: "S00003", etapa: "execucao", valor_orcado: 10000, cliente: { nome: "Opella" } } as unknown as Servico;

  it("soma só os lançamentos da obra", () => {
    const r = calcularResultadoObra(servico, [
      { servico_id: "s1", tipo: "receita", valor: 3000, pago: true },
      { servico_id: "s1", tipo: "receita", valor: 7000, pago: false },
      { servico_id: "s1", tipo: "despesa", valor: 2500, pago: true },
      { servico_id: "s1", tipo: "despesa", valor: 1500, pago: false },
      { servico_id: "outra", tipo: "despesa", valor: 9999, pago: true },
    ]);
    expect(r).toMatchObject({ numero: "S00003", cliente: "Opella", orcado: 10000, receita: 10000, recebido: 3000, despesa: 4000, pago: 2500, margem: 6000 });
    expect(r.margemPercentual).toBeCloseTo(60);
    expect(r.consumoDoOrcadoPercentual).toBeCloseTo(40);
  });

  it("sem receita nem orçado, os percentuais ficam vazios", () => {
    const r = calcularResultadoObra({ ...servico, valor_orcado: null } as Servico, [{ servico_id: "s1", tipo: "despesa", valor: 100, pago: false }]);
    expect(r.margem).toBe(-100);
    expect(r.margemPercentual).toBeNull();
    expect(r.consumoDoOrcadoPercentual).toBeNull();
  });
});

describe("DRE", () => {
  it("lista os meses do intervalo, inclusive virando o ano", () => {
    expect(mesesDoIntervalo("2026-11-15", "2027-02-03")).toEqual(["2026-11", "2026-12", "2027-01", "2027-02"]);
    expect(mesesDoIntervalo("2026-10-01", "2026-10-31")).toEqual(["2026-10"]);
  });

  it("agrupa por competência e fecha receita − variáveis − fixos", () => {
    const dre = calcularDre(
      [
        { tipo: "receita", categoria: "M.O. Fixo Quente", valor: 3000, data_competencia: "2026-09-01" },
        { tipo: "receita", categoria: "M.O. Fixo Quente", valor: 2000, data_competencia: "2026-10-01" },
        { tipo: "receita", categoria: "Comissão", valor: 500, data_competencia: "2026-10-15" },
        { tipo: "despesa", categoria: "Transporte", valor: 120, data_competencia: "2026-10-01" },
        { tipo: "despesa", categoria: "Mão de obra subcontratada", valor: 800, data_competencia: "2026-09-29" },
        { tipo: "despesa", categoria: "Custo fixo", valor: 32, data_competencia: "2026-10-26" },
        { tipo: "despesa", categoria: "Transporte", valor: 999, data_competencia: "2026-08-01" }, // fora do período
      ],
      "2026-09-01",
      "2026-10-31"
    );

    expect(dre.meses).toEqual(["2026-09", "2026-10"]);
    expect(dre.totalReceitas.valores).toEqual([3000, 2500]);
    expect(dre.receitas.map((l) => l.rotulo)).toEqual(["M.O. Fixo Quente", "Comissão"]);
    expect(dre.totalCustosVariaveis.valores).toEqual([800, 120]);
    expect(dre.margemContribuicao.valores).toEqual([2200, 2380]);
    expect(dre.custosFixos.valores).toEqual([0, 32]);
    expect(dre.resultado.valores).toEqual([2200, 2348]);
    expect(dre.resultado.total).toBe(4548);
  });
});
