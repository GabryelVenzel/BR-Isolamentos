import { acabamentoFisicoMaisProximo, materialFisicoMaisProximo } from "@/lib/usecases/orcamento/materialFisico";
import type { MaterialIsolante } from "@/lib/types";

function material(overrides: Partial<MaterialIsolante>): MaterialIsolante {
  return {
    id: 1,
    nome: "Material",
    k_func: "0.03",
    t_min: 0,
    t_max: 500,
    densidade_kg_m3: 50,
    categoria: "Lã de Rocha",
    ativo: true,
    ...overrides,
  };
}

describe("materialFisicoMaisProximo", () => {
  const materiais = [
    material({ id: 1, nome: "Lã de Rocha 32kg/m³", densidade_kg_m3: 32, categoria: "Lã de Rocha" }),
    material({ id: 2, nome: "Lã de Rocha 48kg/m³", densidade_kg_m3: 48, categoria: "Lã de Rocha" }),
    material({ id: 3, nome: "Lã de Rocha 64kg/m³", densidade_kg_m3: 64, categoria: "Lã de Rocha" }),
    material({ id: 4, nome: "Fibra Cerâmica 96kg/m³", densidade_kg_m3: 96, categoria: "Fibra Cerâmica" }),
  ];

  it("acha o material pesquisado de densidade mais próxima na mesma categoria", () => {
    // Catálogo comercial pede Lã de Rocha 75kg/m³ — mais próximo pesquisado é 64kg/m³.
    const resultado = materialFisicoMaisProximo("isolante_la_rocha", 75, materiais);
    expect(resultado?.nome).toBe("Lã de Rocha 64kg/m³");
  });

  it("não cruza categorias — Fibra Cerâmica nunca aparece pra Lã de Rocha", () => {
    const resultado = materialFisicoMaisProximo("isolante_la_rocha", 96, materiais);
    expect(resultado?.categoria).toBe("Lã de Rocha");
  });

  it("ignora materiais inativos", () => {
    const comInativo = [...materiais, material({ id: 5, nome: "Lã de Rocha 74kg/m³", densidade_kg_m3: 74, ativo: false })];
    const resultado = materialFisicoMaisProximo("isolante_la_rocha", 75, comInativo);
    expect(resultado?.nome).toBe("Lã de Rocha 64kg/m³");
  });

  it("retorna null se não há material físico pesquisado pra essa família", () => {
    expect(materialFisicoMaisProximo("isolante_la_rocha", 75, [])).toBeNull();
  });
});

describe("acabamentoFisicoMaisProximo", () => {
  const acabamentos = [
    { id: 1, nome: "Alumínio Polido (Novo)", emissividade: 0.05, ativo: true },
    { id: 2, nome: "Alumínio Oxidado/Intemperizado", emissividade: 0.25, ativo: true },
    { id: 3, nome: "Aço Inox Polido (Novo)", emissividade: 0.08, ativo: true },
    { id: 4, nome: "Aço Galvanizado (Novo)", emissividade: 0.23, ativo: true },
  ];

  it("prefere a variante Novo/Polido quando há mais de uma opção", () => {
    const resultado = acabamentoFisicoMaisProximo("chaparia_aluminio", acabamentos);
    expect(resultado?.nome).toBe("Alumínio Polido (Novo)");
  });

  it("acha por palavra-chave (Inox → Aço Inox Polido)", () => {
    const resultado = acabamentoFisicoMaisProximo("chaparia_inox", acabamentos);
    expect(resultado?.nome).toBe("Aço Inox Polido (Novo)");
  });

  it("retorna null se não achar nenhuma correspondência", () => {
    expect(acabamentoFisicoMaisProximo("chaparia_inox", [])).toBeNull();
  });
});
