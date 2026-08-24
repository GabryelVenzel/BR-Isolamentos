import { calcularDataPrevistaMesAtual, calcularProximoPagamento } from "@/lib/usecases/financeiro/custoFixo";

describe("calcularProximoPagamento", () => {
  it("se o dia ainda não chegou este mês, o próximo pagamento é este mês", () => {
    const agora = new Date(2026, 7, 10); // 10/08/2026 (mês 7 = agosto, 0-indexado)
    expect(calcularProximoPagamento(15, agora)).toBe("2026-08-15");
  });

  it("se o dia já passou este mês, o próximo pagamento é mês seguinte", () => {
    const agora = new Date(2026, 7, 20); // 20/08/2026
    expect(calcularProximoPagamento(15, agora)).toBe("2026-09-15");
  });

  it("se hoje é o próprio dia de pagamento, considera este mês (ainda não passou)", () => {
    const agora = new Date(2026, 7, 15);
    expect(calcularProximoPagamento(15, agora)).toBe("2026-08-15");
  });

  it("dia 31 num mês com menos dias é clampado pro último dia real do mês", () => {
    const agora = new Date(2026, 1, 5); // 05/02/2026 (fevereiro, não bissexto — 28 dias)
    expect(calcularProximoPagamento(31, agora)).toBe("2026-02-28");
  });

  it("vira o ano corretamente quando o próximo pagamento é em dezembro→janeiro", () => {
    const agora = new Date(2026, 11, 20); // 20/12/2026
    expect(calcularProximoPagamento(10, agora)).toBe("2027-01-10");
  });
});

describe("calcularDataPrevistaMesAtual", () => {
  it("sempre retorna o dia deste mês, mesmo se já passou", () => {
    const agora = new Date(2026, 7, 25); // 25/08/2026, dia de pagamento é 5
    expect(calcularDataPrevistaMesAtual(5, agora)).toBe("2026-08-05");
  });

  it("clampa pro último dia real do mês quando necessário", () => {
    const agora = new Date(2026, 1, 5); // fevereiro/2026
    expect(calcularDataPrevistaMesAtual(31, agora)).toBe("2026-02-28");
  });
});
