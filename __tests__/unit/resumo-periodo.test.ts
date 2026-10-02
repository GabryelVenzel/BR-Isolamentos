import { calcularTendencia, periodoAnterior, resolverPeriodo } from "@/lib/usecases/resumo";

// "Hoje" tem que ser calculado do MESMO jeito que a implementação (fuso de
// Brasília, via Intl.DateTimeFormat) — usar `new Date().toISOString()` aqui
// reintroduziria exatamente o bug que resolverPeriodo corrige (ver comentário
// no topo de lib/usecases/resumo/periodo.ts): depois das ~21h de Brasília,
// `.toISOString()` já mostra o dia seguinte (UTC).
function hojeBrasiliaISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

function paraData(iso: string): Date {
  const [ano, mes, dia] = iso.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia));
}

function paraISO(data: Date): string {
  return `${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(2, "0")}-${String(data.getUTCDate()).padStart(2, "0")}`;
}

// Pedido explícito (rodada "filtros por linhas"): os 6 períodos de linha
// (Semana/Mês/Ano × Atual/Anterior) são fechados e alinhados ao calendário —
// substituem o antigo esquema de janela móvel (7d/30d/90d/tudo).
describe("resolverPeriodo", () => {
  it("'semana_atual' começa numa segunda-feira e vai até hoje", () => {
    const hoje = hojeBrasiliaISO();
    const intervalo = resolverPeriodo("semana_atual");

    expect(new Date(`${intervalo.dataInicio}T12:00:00`).getDay()).toBe(1); // segunda-feira
    expect(intervalo.dataFim).toBe(hoje);
    const dias = (paraData(intervalo.dataFim).getTime() - paraData(intervalo.dataInicio).getTime()) / 86_400_000;
    expect(dias).toBeGreaterThanOrEqual(0);
    expect(dias).toBeLessThanOrEqual(6);
    expect(intervalo.label).toBe("Semana atual");
  });

  it("'semana_anterior' é uma semana fechada de segunda a domingo, imediatamente antes da atual", () => {
    const intervalo = resolverPeriodo("semana_anterior");

    expect(new Date(`${intervalo.dataInicio}T12:00:00`).getDay()).toBe(1); // segunda
    expect(new Date(`${intervalo.dataFim}T12:00:00`).getDay()).toBe(0); // domingo
    const dias = (new Date(intervalo.dataFim).getTime() - new Date(intervalo.dataInicio).getTime()) / 86_400_000 + 1;
    expect(dias).toBe(7);

    const atual = resolverPeriodo("semana_atual");
    expect(new Date(intervalo.dataFim).getTime()).toBeLessThan(new Date(atual.dataInicio).getTime());
    expect(intervalo.label).toBe("Semana anterior");
  });

  it("'mes_atual' resolve pro primeiro dia do mês corrente até hoje", () => {
    const hoje = paraData(hojeBrasiliaISO());
    const intervalo = resolverPeriodo("mes_atual");
    const primeiroDiaEsperado = paraISO(new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 1)));

    expect(intervalo.dataInicio).toBe(primeiroDiaEsperado);
    expect(intervalo.dataFim).toBe(paraISO(hoje));
    expect(intervalo.label).toBe("Mês atual");
  });

  it("'mes_anterior' cobre o mês anterior INTEIRO (dia 1 ao último dia), não só 30 dias corridos", () => {
    const hoje = paraData(hojeBrasiliaISO());
    const intervalo = resolverPeriodo("mes_anterior");
    const inicioEsperado = paraISO(new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - 1, 1)));
    const fimEsperado = paraISO(new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 0))); // último dia do mês anterior

    expect(intervalo.dataInicio).toBe(inicioEsperado);
    expect(intervalo.dataFim).toBe(fimEsperado);
    expect(intervalo.label).toBe("Mês anterior");
  });

  it("'ano_atual' resolve de 1º de janeiro até hoje", () => {
    const hoje = paraData(hojeBrasiliaISO());
    const intervalo = resolverPeriodo("ano_atual");

    expect(intervalo.dataInicio).toBe(`${hoje.getUTCFullYear()}-01-01`);
    expect(intervalo.dataFim).toBe(paraISO(hoje));
    expect(intervalo.label).toBe("Ano atual");
  });

  it("'ano_anterior' cobre o ano anterior INTEIRO (1º de janeiro a 31 de dezembro)", () => {
    const hoje = paraData(hojeBrasiliaISO());
    const intervalo = resolverPeriodo("ano_anterior");

    expect(intervalo.dataInicio).toBe(`${hoje.getUTCFullYear() - 1}-01-01`);
    expect(intervalo.dataFim).toBe(`${hoje.getUTCFullYear() - 1}-12-31`);
    expect(intervalo.label).toBe("Ano anterior");
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
