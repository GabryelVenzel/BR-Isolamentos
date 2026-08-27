import {
  arvoresEquivalentes,
  calcularBeneficiosConsolidados,
  calcularPaybackDias,
  calcularPaybackMeses,
  descricaoMaterialCompleta,
  itensContemplados,
  itensNaoContemplados,
  prazoExecucaoDiasUteis,
  projetarEconomiaAcumulada,
  temAnaliseFinanceira,
} from "@/lib/usecases/orcamento/analiseProposta";
import type { ItemOrcamento } from "@/lib/types";

function item(overrides: Partial<ItemOrcamento> = {}): ItemOrcamento {
  return {
    id: 1,
    orcamento_id: 1,
    ordem: 0,
    tipo_trabalho: "quente",
    escopo_itens: [],
    material: "Fibra Cerâmica",
    acabamento: null,
    especificacao_isolante: null,
    especificacao_acabamento: null,
    temperatura_quente: 200,
    temperatura_ambiente: 30,
    umidade_relativa: null,
    velocidade_vento: null,
    geometria: "tubulacao",
    diametro_mm: 100,
    area_m2: 10,
    perimetro_m: null,
    espessura_necessaria_mm: 50,
    temperatura_face_fria: 60,
    perda_com_isolante: 0.1,
    perda_sem_isolante: 1,
    economia_anual: null,
    co2_ton_ano: null,
    manta_kg: null,
    chapa_kg: null,
    rebites: null,
    parafusos: null,
    arame_kg: null,
    vedacao_pu: null,
    vedacit_un: null,
    preco_isolante_m2: 50,
    preco_acabamento_m2: 80,
    trabalho_altura: false,
    eficiencia_global: 1,
    horas_mao_obra: 9,
    subtotal_material: 1000,
    subtotal_mao_obra: 900,
    detalhamento_materiais: [],
    valor_materiais: 1000,
    ...overrides,
  };
}

describe("calcularBeneficiosConsolidados", () => {
  it("soma economia_anual e co2_ton_ano de todos os itens, ignorando os sem cálculo financeiro", () => {
    const itens = [
      item({ economia_anual: 1000, co2_ton_ano: 0.5 }),
      item({ economia_anual: 2000, co2_ton_ano: 0.3 }),
      item({ tipo_trabalho: "frio", economia_anual: null, co2_ton_ano: null }),
    ];
    expect(calcularBeneficiosConsolidados(itens)).toEqual({ economiaAnualTotal: 3000, co2ToneladasAno: 0.8 });
  });

  it("orçamento sem nenhum item com economia devolve zeros", () => {
    expect(calcularBeneficiosConsolidados([item({ economia_anual: null, co2_ton_ano: null })])).toEqual({
      economiaAnualTotal: 0,
      co2ToneladasAno: 0,
    });
  });
});

describe("calcularPaybackMeses", () => {
  it("payback = (valor final ÷ economia anual) × 12", () => {
    expect(calcularPaybackMeses(24834.61, 24834.61)).toBe(12);
    expect(calcularPaybackMeses(12000, 24000)).toBe(6);
  });

  it("sem economia anual, devolve null (não exibe payback enganoso)", () => {
    expect(calcularPaybackMeses(10000, 0)).toBeNull();
  });
});

describe("calcularPaybackDias", () => {
  it("payback em dias = (valor final ÷ economia anual) × 365", () => {
    expect(calcularPaybackDias(672, 21800)).toBe(11);
  });

  it("sem economia anual, devolve null", () => {
    expect(calcularPaybackDias(672, 0)).toBeNull();
  });
});

describe("projetarEconomiaAcumulada", () => {
  it("sem reajuste (0%), a economia anual é constante e o acumulado cresce linearmente", () => {
    const linhas = projetarEconomiaAcumulada(1000, 0, 3);
    expect(linhas).toEqual([
      { ano: 1, economiaDoAno: 1000, acumulado: 1000 },
      { ano: 2, economiaDoAno: 1000, acumulado: 2000 },
      { ano: 3, economiaDoAno: 1000, acumulado: 3000 },
    ]);
  });

  it("com reajuste, a economia do ano cresce geometricamente", () => {
    const linhas = projetarEconomiaAcumulada(1000, 10, 2);
    expect(linhas[0].economiaDoAno).toBe(1000);
    expect(linhas[1].economiaDoAno).toBe(1100);
    expect(linhas[1].acumulado).toBe(2100);
  });

  it("padrão de 10 anos quando `anos` não é informado", () => {
    expect(projetarEconomiaAcumulada(1000, 0)).toHaveLength(10);
  });
});

describe("arvoresEquivalentes", () => {
  it("converte toneladas de CO2/ano em número de árvores, usando o fator configurado", () => {
    expect(arvoresEquivalentes(1.05, 22)).toBe(48); // 1050kg / 22kg ≈ 47.7 → 48
  });

  it("fator zero/negativo não gera divisão por zero", () => {
    expect(arvoresEquivalentes(1, 0)).toBe(0);
  });
});

describe("prazoExecucaoDiasUteis", () => {
  it("soma as horas de todos os trechos e divide pela jornada, arredondando para cima", () => {
    const itens = [item({ horas_mao_obra: 10 }), item({ horas_mao_obra: 8 })];
    expect(prazoExecucaoDiasUteis(itens, 9)).toBe(2); // 18h / 9h/dia = 2 dias exatos
  });

  it("dia parcial conta como dia inteiro", () => {
    const itens = [item({ horas_mao_obra: 10 })];
    expect(prazoExecucaoDiasUteis(itens, 9)).toBe(2); // 10h / 9h/dia = 1.11 → 2
  });

  it("nunca devolve menos que 1 dia quando há horas de mão de obra", () => {
    const itens = [item({ horas_mao_obra: 1 })];
    expect(prazoExecucaoDiasUteis(itens, 9)).toBe(1);
  });
});

describe("temAnaliseFinanceira", () => {
  it("true só quando há valor final e economia anual positivos", () => {
    expect(temAnaliseFinanceira({ valor_final: 1000 }, 500)).toBe(true);
    expect(temAnaliseFinanceira({ valor_final: 0 }, 500)).toBe(false);
    expect(temAnaliseFinanceira({ valor_final: 1000 }, 0)).toBe(false);
  });
});

describe("descricaoMaterialCompleta", () => {
  it("combina material + especificação + espessura num único texto", () => {
    expect(
      descricaoMaterialCompleta({ material: "Fibra Cerâmica", especificacao_isolante: "96kg/m³", espessura_necessaria_mm: 51 })
    ).toBe("Fibra Cerâmica 96kg/m³ 51mm");
  });

  it("omite a espessura quando zero (ex.: material customizado sem cálculo térmico)", () => {
    expect(descricaoMaterialCompleta({ material: "Manta X", especificacao_isolante: null, espessura_necessaria_mm: 0 })).toBe("Manta X");
  });

  it("omite a especificação quando null, sem deixar espaço duplo", () => {
    expect(descricaoMaterialCompleta({ material: "Lã de Rocha", especificacao_isolante: null, espessura_necessaria_mm: 40 })).toBe(
      "Lã de Rocha 40mm"
    );
  });
});

describe("itensContemplados / itensNaoContemplados", () => {
  it("material_mo contempla material e acabamento; somente_mo não", () => {
    expect(itensContemplados("material_mo")).toContain("Material isolante completo");
    expect(itensContemplados("somente_mo")).not.toContain("Material isolante completo");
  });

  it("somente_mo lista material/acabamento como não contemplado; material_mo não", () => {
    expect(itensNaoContemplados("somente_mo").some((t) => t.includes("Material isolante"))).toBe(true);
    expect(itensNaoContemplados("material_mo").some((t) => t.includes("Material isolante"))).toBe(false);
  });

  it("acesso para trabalho em altura nunca está contemplado, em nenhum dos dois tipos", () => {
    for (const tipo of ["material_mo", "somente_mo"] as const) {
      expect(itensNaoContemplados(tipo).some((t) => t.includes("trabalho em altura"))).toBe(true);
    }
  });
});
