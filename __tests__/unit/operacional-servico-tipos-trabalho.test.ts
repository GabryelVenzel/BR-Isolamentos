import { atualizarServico } from "@/lib/usecases/operacional";
import type { Servico } from "@/lib/types/domain";

function servico(overrides: Partial<Servico> = {}): Servico {
  return {
    id: "s1",
    numero_servico: "S00001",
    lead_id: "l1",
    numero_lead: "L00001",
    orcamento_id: 1,
    numero_orcamento: "O00001",
    cliente_id: 1,
    etapa: "planejamento",
    tipo_trabalho: "bancada",
    tipos_trabalho: ["bancada"],
    valor_orcado: null,
    valor_real: null,
    data_inicio: null,
    data_fim_prevista: null,
    data_fim_real: null,
    parceiro_principal_id: "p1",
    pessoas_alocadas: null,
    parceiros_alocados: [],
    descricao: null,
    notas: null,
    foto_principal_url: null,
    fotos_url: [],
    pdf_relatorio_url: null,
    responsavel_email: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function criarServicoRepoFake(inicial: Servico) {
  let estado = inicial;
  return {
    findById: jest.fn(async () => estado),
    update: jest.fn(async (_id: string, dados: Partial<Servico>) => {
      estado = { ...estado, ...dados };
      return estado;
    }),
  };
}

describe("atualizarServico — múltiplos tipos de trabalho", () => {
  it("grava tipos_trabalho (array) e espelha o primeiro item em tipo_trabalho (legado)", async () => {
    const servicoRepo = criarServicoRepoFake(servico());

    const resultado = await atualizarServico(
      "s1",
      { tipos_trabalho: ["caldeiraria", "isolamentos_fixos"] },
      { servicoRepo: servicoRepo as never }
    );

    expect(resultado.tipos_trabalho).toEqual(["caldeiraria", "isolamentos_fixos"]);
    expect(resultado.tipo_trabalho).toBe("caldeiraria");
  });

  it("não mexe em tipo_trabalho/tipos_trabalho quando o campo não é enviado", async () => {
    const servicoRepo = criarServicoRepoFake(servico({ tipos_trabalho: ["bancada"], tipo_trabalho: "bancada" }));

    const resultado = await atualizarServico("s1", { descricao: "Nova descrição" }, { servicoRepo: servicoRepo as never });

    expect(resultado.tipos_trabalho).toEqual(["bancada"]);
    expect(resultado.tipo_trabalho).toBe("bancada");
  });
});
