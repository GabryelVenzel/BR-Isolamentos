import { formatarData, formatarDataHora } from "@/lib/format";

// Regressão: `new Date("2026-08-20")` (data pura, sem hora) é interpretado
// pelo JS como UTC meia-noite; formatado depois no fuso local, isso pode
// exibir o dia anterior em fusos negativos (ex.: America/Sao_Paulo, UTC-3).
// Esses testes fixam o comportamento correto independente do fuso horário
// da máquina que roda o teste (CI, dev local, etc.).
describe("formatarData", () => {
  it("não desloca o dia para datas puras (YYYY-MM-DD)", () => {
    expect(formatarData("2026-08-20")).toBe("20/08/2026");
    expect(formatarData("2026-01-01")).toBe("01/01/2026");
    expect(formatarData("2026-12-31")).toBe("31/12/2026");
  });

  it("aceita um objeto Date diretamente", () => {
    expect(formatarData(new Date(2026, 7, 20))).toBe("20/08/2026");
  });
});

describe("formatarDataHora", () => {
  it("não desloca o dia para datas puras (YYYY-MM-DD)", () => {
    expect(formatarDataHora("2026-08-20")).toContain("20/08/2026");
  });

  it("continua funcionando para timestamps completos", () => {
    // Um timestamp ISO completo (com hora/fuso) não passa pelo caminho de
    // "data pura" — o comportamento aqui é o parsing padrão do JS.
    const resultado = formatarDataHora("2026-08-20T12:00:00.000Z");
    expect(resultado).toMatch(/\d{2}\/\d{2}\/2026/);
  });
});
