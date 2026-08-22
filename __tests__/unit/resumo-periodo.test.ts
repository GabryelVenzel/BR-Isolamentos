import { calcularTendencia, periodoAnterior, resolverPeriodo } from "@/lib/usecases/resumo";

describe("resolverPeriodo", () => {
  it("'mes' resolve pro primeiro dia do mês corrente até hoje", () => {
    const hoje = new Date();
    const intervalo = resolverPeriodo("mes");
    const primeiroDiaEsperado = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);

    expect(intervalo.dataInicio).toBe(primeiroDiaEsperado);
    expect(intervalo.dataFim).toBe(hoje.toISOString().slice(0, 10));
    expect(intervalo.label).toBe("Este mês");
  });

  it("'7d' cobre exatamente 7 dias (hoje inclusive)", () => {
    const intervalo = resolverPeriodo("7d");
    const dias =
      (new Date(intervalo.dataFim).getTime() - new Date(intervalo.dataInicio).getTime()) / 86_400_000 + 1;
    expect(dias).toBe(7);
  });

  it("'custom' exige dataInicio e dataFim, senão lança erro", () => {
    expect(() => resolverPeriodo("custom")).toThrow();
    expect(() => resolverPeriodo("custom", "2026-01-01", "2026-01-31")).not.toThrow();
  });

  it("'custom' usa exatamente as datas informadas", () => {
    const intervalo = resolverPeriodo("custom", "2026-03-01", "2026-03-15");
    expect(intervalo).toMatchObject({ dataInicio: "2026-03-01", dataFim: "2026-03-15" });
  });
});

describe("periodoAnterior", () => {
  it("mesma duração, imediatamente antes do início do período atual", () => {
    const atual = { dataInicio: "2026-08-01", dataFim: "2026-08-31", label: "Este mês" };
    const anterior = periodoAnterior(atual);

    expect(anterior.dataFim).toBe("2026-07-31"); // dia antes do início do atual
    expect(anterior.dataInicio).toBe("2026-07-01"); // mesma duração (31 dias)
  });

  it("período de 1 dia continua com 1 dia no anterior", () => {
    const atual = { dataInicio: "2026-08-15", dataFim: "2026-08-15", label: "" };
    const anterior = periodoAnterior(atual);
    expect(anterior.dataInicio).toBe("2026-08-14");
    expect(anterior.dataFim).toBe("2026-08-14");
  });
});

describe("calcularTendencia", () => {
  it("percentual positivo quando atual > anterior", () => {
    const resultado = calcularTendencia(150, 100);
    expect(resultado.percentual).toBeCloseTo(50, 5);
    expect(resultado.cor).toBe("positiva");
  });

  it("percentual negativo quando atual < anterior", () => {
    const resultado = calcularTendencia(50, 100);
    expect(resultado.percentual).toBeCloseTo(-50, 5);
    expect(resultado.cor).toBe("negativa");
  });

  it("retorna null (não Infinity) quando o período anterior é zero", () => {
    const comCrescimento = calcularTendencia(100, 0);
    expect(comCrescimento.percentual).toBeNull();
    expect(comCrescimento.cor).toBe("positiva");

    const semMudanca = calcularTendencia(0, 0);
    expect(semMudanca.percentual).toBeNull();
    expect(semMudanca.cor).toBe("neutra");
  });

  it("variação pequena (<0.5%) é tratada como neutra, não positiva/negativa", () => {
    const resultado = calcularTendencia(100.2, 100);
    expect(resultado.cor).toBe("neutra");
  });
});
