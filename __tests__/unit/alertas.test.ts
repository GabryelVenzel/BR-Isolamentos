import { alertasDocumentos, alertasFinanceiros, alertasObras, diasEntre, ordenarAlertas, situacaoValidade, type ObraParaAlerta } from "@/lib/alertas";
import { podeAcessarRota, type Acesso } from "@/lib/acesso";

const HOJE = "2026-10-09";

describe("diasEntre e situacaoValidade", () => {
  it("conta dias inteiros, inclusive virando o mês", () => {
    expect(diasEntre(HOJE, HOJE)).toBe(0);
    expect(diasEntre(HOJE, "2026-10-16")).toBe(7);
    expect(diasEntre(HOJE, "2026-11-08")).toBe(30);
    expect(diasEntre(HOJE, "2026-10-01")).toBe(-8);
  });

  it("classifica a validade de um documento", () => {
    expect(situacaoValidade(null, HOJE, 30)).toBe("sem_validade");
    expect(situacaoValidade("2026-10-08", HOJE, 30)).toBe("vencido");
    expect(situacaoValidade(HOJE, HOJE, 30)).toBe("vencendo"); // vence hoje ainda não está vencido
    expect(situacaoValidade("2026-11-08", HOJE, 30)).toBe("vencendo");
    expect(situacaoValidade("2026-11-09", HOJE, 30)).toBe("em_dia");
  });
});

describe("alertasFinanceiros", () => {
  it("separa vencidas e a vencer, a pagar e a receber", () => {
    const alertas = alertasFinanceiros(
      [
        { tipo: "despesa", valor: 100, data: "2026-10-01" }, // vencida
        { tipo: "despesa", valor: 50, data: "2026-10-05" }, // vencida
        { tipo: "despesa", valor: 32, data: "2026-10-16" }, // vence em 7
        { tipo: "despesa", valor: 999, data: "2026-10-17" }, // fora do prazo
        { tipo: "receita", valor: 3000, data: "2026-09-30" }, // atrasada
        { tipo: "receita", valor: 700, data: HOJE }, // prevista hoje
      ],
      HOJE,
      7
    );

    expect(alertas.map((a) => [a.id, a.severidade])).toEqual([
      ["contas-a-pagar-vencidas", "critico"],
      ["contas-a-receber-vencidas", "critico"],
      ["contas-a-pagar-vencendo", "atencao"],
      ["contas-a-receber-vencendo", "atencao"],
    ]);
    expect(alertas[0].titulo).toBe("2 contas a pagar vencidas");
    expect(alertas[0].detalhe).toContain("150,00");
    expect(alertas[2].titulo).toBe("1 conta a pagar vence nos próximos 7 dias");
    expect(alertas[2].detalhe).toContain("32,00");
    expect(alertas.every((a) => a.modulo === "financeiro")).toBe(true);
  });

  it("sem contas em aberto relevantes, não gera alerta", () => {
    expect(alertasFinanceiros([{ tipo: "despesa", valor: 10, data: "2026-12-01" }], HOJE, 7)).toEqual([]);
  });
});

describe("alertasDocumentos", () => {
  it("separa funcionário e empresa, vencido e vencendo; ignora sem validade", () => {
    const alertas = alertasDocumentos(
      [
        { nome: "ASO", validade: "2026-09-01", funcionario: "Juliar" },
        { nome: "NR-35", validade: "2026-10-20", funcionario: "Wesley" },
        { nome: "NR-10", validade: "2027-05-01", funcionario: "Wesley" },
        { nome: "PGR", validade: "2026-10-30", funcionario: null },
        { nome: "Contrato Social", validade: null, funcionario: null },
      ],
      HOJE,
      30
    );

    expect(alertas.map((a) => a.id)).toEqual(["documentos-funcionario-vencidos", "documentos-funcionario-vencendo", "documentos-empresa-vencendo"]);
    expect(alertas[0]).toMatchObject({ severidade: "critico", titulo: "1 documento de funcionários vencido", detalhe: "ASO (Juliar).", href: "/rh/funcionarios" });
    expect(alertas[1].detalhe).toBe("NR-35 (Wesley).");
    expect(alertas[2]).toMatchObject({ titulo: "1 documento da empresa vence em até 30 dias", detalhe: "PGR.", href: "/rh" });
  });

  it("resume a lista quando há muitos documentos", () => {
    const documentos = ["A", "B", "C", "D", "E"].map((nome) => ({ nome, validade: "2026-01-01", funcionario: null }));
    expect(alertasDocumentos(documentos, HOJE, 30)[0].detalhe).toBe("A, B, C e mais 2.");
  });
});

describe("alertasObras", () => {
  const obra = (o: Partial<ObraParaAlerta>): ObraParaAlerta => ({
    id: "1",
    numero: "S00001",
    cliente: "Cliente",
    etapa: "execucao",
    data_fim_prevista: null,
    orcado: 0,
    receita: 0,
    despesa: 0,
    ...o,
  });

  it("prazo vencido só conta para obra não finalizada", () => {
    const alertas = alertasObras(
      [
        obra({ id: "1", numero: "S00001", data_fim_prevista: "2026-10-01" }),
        obra({ id: "2", numero: "S00002", data_fim_prevista: "2026-10-01", etapa: "finalizado", receita: 10 }),
        obra({ id: "3", numero: "S00003", data_fim_prevista: HOJE }), // termina hoje: ainda no prazo
      ],
      HOJE
    );
    expect(alertas).toHaveLength(1);
    expect(alertas[0]).toMatchObject({ id: "obras-prazo-vencido", severidade: "critico", detalhe: "S00001 (Cliente)." });
  });

  it("despesa acima do orçado e finalizada sem receita", () => {
    const alertas = alertasObras(
      [
        obra({ id: "1", numero: "S00003", cliente: "Opella", orcado: 293.36, despesa: 3231, receita: 3000 }),
        obra({ id: "2", numero: "S00004", cliente: null, orcado: 0, despesa: 500 }), // sem orçado: não compara
        obra({ id: "3", numero: "S00005", etapa: "finalizado", receita: 0 }),
      ],
      HOJE
    );
    expect(alertas.map((a) => a.id)).toEqual(["obras-despesa-acima-orcado", "obras-finalizadas-sem-receita"]);
    expect(alertas[0].titulo).toBe("1 obra com despesa acima do orçado");
    expect(alertas[0].detalhe).toContain("S00003 (Opella)");
    expect(alertas[1].detalhe).toBe("S00005 (Cliente).");
  });
});

describe("ordenarAlertas e rotas", () => {
  it("críticos primeiro, mantendo a ordem dentro da severidade", () => {
    const base = { modulo: "rh" as const, titulo: "", detalhe: "", href: "" };
    const ordenados = ordenarAlertas([
      { ...base, id: "a", severidade: "atencao" },
      { ...base, id: "b", severidade: "critico" },
      { ...base, id: "c", severidade: "atencao" },
      { ...base, id: "d", severidade: "critico" },
    ]);
    expect(ordenados.map((a) => a.id)).toEqual(["b", "d", "a", "c"]);
  });

  it("qualquer usuário ativo lê os alertas; só administrador altera os prazos", () => {
    const comum: Acesso = { admin: false, modulos: ["comercial"], ativo: true, trocarSenha: false };
    const admin: Acesso = { admin: true, modulos: [], ativo: true, trocarSenha: false };
    expect(podeAcessarRota(comum, "/api/alertas", "GET")).toBe(true);
    expect(podeAcessarRota(comum, "/api/alertas/config", "PUT")).toBe(false);
    expect(podeAcessarRota(admin, "/api/alertas/config", "PUT")).toBe(true);
  });
});
