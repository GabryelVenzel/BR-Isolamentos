import {
  ausenciasNoPeriodo,
  ausenteNoDia,
  checklistObrigatorios,
  diasDeAusencia,
  documentosVigentes,
  listaDocumentosObrigatorios,
  listaTiposDocumento,
  situacaoDocumentacao,
  somarMeses,
  validadePadrao,
} from "@/lib/rh";
import { calcularCapacidadeDia, ID_EQUIPE_PROPRIA } from "@/lib/usecases/operacional/capacidade";
import type { Funcionario, Servico } from "@/lib/types/domain";

describe("validade padrão dos documentos (migração 052)", () => {
  it("somarMeses soma meses e ajusta o fim do mês", () => {
    expect(somarMeses("2026-10-14", 12)).toBe("2027-10-14");
    expect(somarMeses("2026-10-14", 24)).toBe("2028-10-14");
    expect(somarMeses("2027-01-31", 1)).toBe("2027-02-28");
    expect(somarMeses("2028-01-31", 1)).toBe("2028-02-29");
    expect(somarMeses("2026-11-15", 3)).toBe("2027-02-15");
  });

  it("validadePadrao: emissão + prazo do tipo; sem prazo ou sem emissão, nada", () => {
    expect(validadePadrao({ validade_meses: 12 }, "2026-10-14")).toBe("2027-10-14");
    expect(validadePadrao({ validade_meses: null }, "2026-10-14")).toBeNull();
    expect(validadePadrao({ validade_meses: 12 }, "")).toBeNull();
    expect(validadePadrao(undefined, "2026-10-14")).toBeNull();
  });

  it("listas configuráveis são normalizadas (sem nome sai; prazo inválido vira 'não vence'; categoria desconhecida vira 'outros')", () => {
    expect(listaTiposDocumento([{ id: "aso", nome: " ASO ", validade_meses: 12 }, { id: "x", nome: "" }, { id: "nr06", nome: "NR-06", validade_meses: 0 }])).toEqual([
      { id: "aso", nome: "ASO", validade_meses: 12 },
      { id: "nr06", nome: "NR-06", validade_meses: null },
    ]);
    expect(listaDocumentosObrigatorios([{ id: "pgr", nome: "PGR", categoria: "sst", validade_meses: "24" }, { id: "y", nome: "Y", categoria: "inventada" }])).toEqual([
      { id: "pgr", nome: "PGR", categoria: "sst", validade_meses: 24 },
      { id: "y", nome: "Y", categoria: "outros", validade_meses: null },
    ]);
    expect(listaTiposDocumento(null)).toEqual([]);
  });
});

describe("documentos vigentes e situação da documentação", () => {
  const hoje = "2026-10-14";

  it("de cada tipo vale só o de validade mais longa; sem tipo, cada um conta", () => {
    const docs = [
      { id: "aso-velho", tipo_id: "aso", validade: "2026-09-01" },
      { id: "aso-novo", tipo_id: "aso", validade: "2027-09-01" },
      { id: "livre", tipo_id: null, validade: "2026-01-01" },
    ];
    expect(documentosVigentes(docs).map((d) => d.id).sort()).toEqual(["aso-novo", "livre"]);
  });

  it("documento sem validade (não vence) prevalece sobre um que vence", () => {
    expect(documentosVigentes([{ id: "a", tipo_id: "nr06", validade: "2027-01-01" }, { id: "b", tipo_id: "nr06", validade: null }]).map((d) => d.id)).toEqual(["b"]);
  });

  it("ASO renovado: o vencido deixa de contar e a situação fica em dia", () => {
    const docs = [
      { tipo_id: "aso", validade: "2026-09-01" },
      { tipo_id: "aso", validade: "2027-09-01" },
    ];
    expect(situacaoDocumentacao(docs, hoje, 30)).toEqual({ situacao: "em_dia", vencidos: 0, vencendo: 0 });
    expect(situacaoDocumentacao([docs[0]], hoje, 30)).toEqual({ situacao: "vencido", vencidos: 1, vencendo: 0 });
  });

  it("vencendo dentro do prazo de aviso; sem documentos é uma situação própria", () => {
    expect(situacaoDocumentacao([{ tipo_id: "nr35", validade: "2026-11-01" }], hoje, 30).situacao).toBe("vencendo");
    expect(situacaoDocumentacao([], hoje, 30).situacao).toBe("sem_documentos");
  });

  it("checklist de obrigatórios: em dia, vencido e faltando", () => {
    const obrigatorios = [
      { id: "pgr", nome: "PGR", categoria: "sst" as const, validade_meses: 24 },
      { id: "cnd", nome: "CND Federal", categoria: "fiscal" as const, validade_meses: 6 },
      { id: "contrato", nome: "Contrato Social", categoria: "juridico" as const, validade_meses: null },
    ];
    const docs = [
      { id: 1, tipo_id: "pgr", validade: "2027-05-01" },
      { id: 2, tipo_id: "cnd", validade: "2026-10-01" },
      { id: 3, tipo_id: null, validade: null },
    ];
    expect(checklistObrigatorios(obrigatorios, docs, hoje, 30).map((c) => [c.obrigatorio.id, c.situacao, c.documento?.id ?? null])).toEqual([
      ["pgr", "em_dia", 1],
      ["cnd", "vencido", 2],
      ["contrato", "faltando", null],
    ]);
  });
});

describe("férias e afastamentos", () => {
  const ausencias = [{ funcionario_id: "f1", inicio: "2026-10-10", fim: "2026-10-20" }];

  it("ausenteNoDia considera início e fim inclusive", () => {
    expect(ausenteNoDia(ausencias, "f1", "2026-10-10")).toBe(true);
    expect(ausenteNoDia(ausencias, "f1", "2026-10-20")).toBe(true);
    expect(ausenteNoDia(ausencias, "f1", "2026-10-21")).toBe(false);
    expect(ausenteNoDia(ausencias, "f2", "2026-10-15")).toBe(false);
  });

  it("ausenciasNoPeriodo cruza com o período da obra (fim em aberto = de lá em diante)", () => {
    expect(ausenciasNoPeriodo(ausencias, "f1", "2026-10-18", "2026-11-30")).toHaveLength(1);
    expect(ausenciasNoPeriodo(ausencias, "f1", "2026-10-21", "2026-11-30")).toHaveLength(0);
    expect(ausenciasNoPeriodo(ausencias, "f1", "2026-09-01", "2026-10-09")).toHaveLength(0);
    expect(ausenciasNoPeriodo(ausencias, "f1", "2026-09-01", null)).toHaveLength(1);
  });

  it("diasDeAusencia conta o primeiro e o último dia", () => {
    expect(diasDeAusencia("2026-10-10", "2026-10-20")).toBe(11);
    expect(diasDeAusencia("2026-10-10", "2026-10-10")).toBe(1);
  });

  it("capacidade: funcionário ausente no dia não conta como disponível", () => {
    const funcionarios = [
      { id: "f1", status: "ativo", tipos_trabalho: ["isolador"] },
      { id: "f2", status: "ativo", tipos_trabalho: ["isolador"] },
    ] as Array<Pick<Funcionario, "id" | "status" | "tipos_trabalho">>;
    const equipe = (data: string) => calcularCapacidadeDia(data, [], [] as Servico[], funcionarios, ausencias).porParceiro.find((p) => p.parceiroId === ID_EQUIPE_PROPRIA);

    expect(equipe("2026-10-15")?.totalPessoas).toBe(1);
    expect(equipe("2026-10-25")?.totalPessoas).toBe(2);
  });
});
