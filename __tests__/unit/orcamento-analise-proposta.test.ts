import {
  arvoresEquivalentes,
  calcularBeneficiosConsolidados,
  calcularPaybackDias,
  calcularPaybackMeses,
  descricaoMaterialCompleta,
  distribuirResumoFinanceiroSimplificado,
  imagensRelevantesParaTipo,
  itensContemplados,
  itensNaoContemplados,
  linhasEspecificacoesTecnicas,
  linhasMaoDeObra,
  linhasOperacionaisIncluso,
  linhasQuantificacaoMateriais,
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

  it("não repete a especificação se ela já estiver dentro do nome do material (bug relatado: \"64kg/m³ 64kg/m³\")", () => {
    expect(
      descricaoMaterialCompleta({ material: "Lã de Rocha 64kg/m³", especificacao_isolante: "64kg/m³", espessura_necessaria_mm: 51 })
    ).toBe("Lã de Rocha 64kg/m³ 51mm");
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

describe("linhasEspecificacoesTecnicas", () => {
  it("uma linha por item de Escopo, não por trecho", () => {
    const linhas = linhasEspecificacoesTecnicas([
      item({
        id: 1,
        material: "Lã de Rocha",
        escopo_itens: [
          { id: "a", nome: 'Tubo 2"', tipo: "tubulacao", diametro_mm: 50, comprimento_m: 25, quantidade: null, metragem_manual_m2: null, metragem_editada: false },
          { id: "b", nome: 'Curva 2"', tipo: "curva", diametro_mm: 50, comprimento_m: null, quantidade: 2, metragem_manual_m2: null, metragem_editada: false },
        ],
      }),
    ]);
    expect(linhas).toHaveLength(2);
    // isolamento = material + espessura (via descricaoMaterialCompleta,
    // pedido explícito) — não só o nome do material.
    expect(linhas[0]).toMatchObject({ trechoNumero: 1, isolamento: "Lã de Rocha 50mm", descricao: 'Tubo 2"', qtd: "25 m" });
    expect(linhas[1]).toMatchObject({ trechoNumero: 1, isolamento: "Lã de Rocha 50mm", descricao: 'Curva 2"', qtd: "2 un." });
  });

  it("trecho sem Escopo detalhado (orçamento legado) cai numa única linha de fallback", () => {
    const linhas = linhasEspecificacoesTecnicas([item({ escopo_itens: [], area_m2: 7.5 })]);
    expect(linhas).toEqual([expect.objectContaining({ descricao: "—", qtd: "—", areaM2: 7.5 })]);
  });

  it("numeração de trecho soma corretamente em múltiplos trechos", () => {
    const linhas = linhasEspecificacoesTecnicas([item({ id: 1, escopo_itens: [] }), item({ id: 2, escopo_itens: [] })]);
    expect(linhas.map((l) => l.trechoNumero)).toEqual([1, 2]);
  });
});

describe("distribuirResumoFinanceiroSimplificado", () => {
  it("reparte valor_final proporcionalmente entre material e mão de obra (mesma % embutida)", () => {
    const resultado = distribuirResumoFinanceiroSimplificado({
      valor_materiais: 8000,
      valor_mao_obra: 2000,
      valor_deslocamento: 0,
      valor_hospedagem: 0,
      valor_frete: 0,
      subtotal: 10000,
      valor_final: 15000, // 50% de impostos+margem embutidos
    });
    expect(resultado.material).toBe(12000); // 8000 × 1.5
    expect(resultado.maoDeObra).toBe(3000); // 15000 - 12000
    expect(resultado.material + resultado.maoDeObra).toBe(15000);
  });

  it("deslocamento/hospedagem/frete são absorvidos pela linha de mão de obra", () => {
    const resultado = distribuirResumoFinanceiroSimplificado({
      valor_materiais: 0,
      valor_mao_obra: 1000,
      valor_deslocamento: 200,
      valor_hospedagem: 300,
      valor_frete: 500,
      subtotal: 2000,
      valor_final: 2000,
    });
    expect(resultado.material).toBe(0);
    expect(resultado.maoDeObra).toBe(2000);
  });

  it("subtotal zero não gera divisão por zero — tudo cai em mão de obra", () => {
    expect(
      distribuirResumoFinanceiroSimplificado({
        valor_materiais: 0,
        valor_mao_obra: 0,
        valor_deslocamento: 0,
        valor_hospedagem: 0,
        valor_frete: 0,
        subtotal: 0,
        valor_final: 500,
      })
    ).toEqual({ material: 0, maoDeObra: 500 });
  });
});

describe("imagensRelevantesParaTipo", () => {
  const foto = (tipo: "quente" | "frio" | "ambos" | null) => ({ id: tipo ?? "legado", tipo_trabalho: tipo });

  it("orçamento misto mostra todas as fotos, de qualquer tipo", () => {
    const fotos = [foto("quente"), foto("frio"), foto("ambos"), foto(null)];
    expect(imagensRelevantesParaTipo(fotos, "misto")).toHaveLength(4);
  });

  it("orçamento quente mostra fotos 'quente', 'ambos' e não classificadas — não mostra 'frio'", () => {
    const fotos = [foto("quente"), foto("frio"), foto("ambos"), foto(null)];
    const resultado = imagensRelevantesParaTipo(fotos, "quente");
    expect(resultado.map((f) => f.tipo_trabalho)).toEqual(["quente", "ambos", null]);
  });

  it("orçamento frio mostra fotos 'frio', 'ambos' e não classificadas — não mostra 'quente'", () => {
    const fotos = [foto("quente"), foto("frio"), foto("ambos"), foto(null)];
    const resultado = imagensRelevantesParaTipo(fotos, "frio");
    expect(resultado.map((f) => f.tipo_trabalho)).toEqual(["frio", "ambos", null]);
  });
});

describe("linhasQuantificacaoMateriais", () => {
  it("uma linha por material de detalhamento_materiais, marcada com o número do trecho", () => {
    const linhas = linhasQuantificacaoMateriais([
      item({
        id: 1,
        detalhamento_materiais: [
          { chave: "isolante", titulo: "Fibra Cerâmica", quantidade: 4.8, unidade: "m²", preco_unitario: 50, subtotal: 240 },
          { chave: "rebite", titulo: "Rebite", quantidade: 80, unidade: "un.", preco_unitario: 0.5, subtotal: 40 },
        ],
      }),
    ]);
    expect(linhas).toEqual([
      { trechoNumero: 1, titulo: "Fibra Cerâmica", quantidade: 4.8, unidade: "m²" },
      { trechoNumero: 1, titulo: "Rebite", quantidade: 80, unidade: "un." },
    ]);
  });

  it("trecho sem detalhamento_materiais não gera linha nenhuma", () => {
    expect(linhasQuantificacaoMateriais([item({ detalhamento_materiais: [] })])).toEqual([]);
  });
});

describe("linhasOperacionaisIncluso", () => {
  it("mão de obra NÃO aparece aqui (foi pra linhasMaoDeObra, com horas reais); alimentação sempre aparece", () => {
    const linhas = linhasOperacionaisIncluso({ valor_deslocamento: 0, valor_hospedagem: 0, valor_frete: 0 });
    expect(linhas).toEqual(["Alimentação"]);
  });

  it("inclui deslocamento/hospedagem/frete quando o orçamento tem esse custo", () => {
    const linhas = linhasOperacionaisIncluso({ valor_deslocamento: 200, valor_hospedagem: 300, valor_frete: 100 });
    expect(linhas).toEqual(["Deslocamento", "Hospedagem", "Frete", "Alimentação"]);
  });
});

describe("linhasMaoDeObra", () => {
  it("uma linha por trecho, deixando explícito que é uma dupla (2 pessoas)", () => {
    const linhas = linhasMaoDeObra([item({ id: 1, horas_mao_obra: 13.1 }), item({ id: 2, horas_mao_obra: 5 })]);
    expect(linhas).toEqual([
      { trechoNumero: 1, titulo: "Mão de obra (dupla de 2 pessoas)", quantidade: 13.1, unidade: "h" },
      { trechoNumero: 2, titulo: "Mão de obra (dupla de 2 pessoas)", quantidade: 5, unidade: "h" },
    ]);
  });

  it("trecho sem horas de mão de obra não gera linha", () => {
    expect(linhasMaoDeObra([item({ horas_mao_obra: 0 })])).toEqual([]);
  });
});
