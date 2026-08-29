import { quantificarMateriais, type ParametrosQuantificacao } from "@/lib/usecases/orcamento/quantificarMateriais";
import type { ItemEscopo } from "@/lib/types";

// Parâmetros padrão pós-migração 023 (era 20%/30%, ver
// sql-migration-023-quantificacao-isolante-precisa.sql).
const parametros: ParametrosQuantificacao = {
  isolante_acrescimo_percentual: 10,
  acabamento_acrescimo_percentual: 20,
  rebite_por_m2: 20,
  parafusos_por_m2: 20,
  arame_metros_por_m2: 5,
  silicone_intervalo_m2: 2,
};

function plano(m2: number): ItemEscopo {
  return { id: "1", nome: "Item", tipo: "plano", diametro_mm: null, comprimento_m: null, quantidade: null, metragem_manual_m2: m2, metragem_editada: false };
}

function tubulacao(diametroMm: number, comprimentoM: number): ItemEscopo {
  return {
    id: "1",
    nome: "Tubo",
    tipo: "tubulacao",
    diametro_mm: diametroMm,
    comprimento_m: comprimentoM,
    quantidade: null,
    metragem_manual_m2: null,
    metragem_editada: false,
  };
}

function curva(diametroMm: number, quantidade: number): ItemEscopo {
  return {
    id: "1",
    nome: "Curva",
    tipo: "curva",
    diametro_mm: diametroMm,
    comprimento_m: null,
    quantidade,
    metragem_manual_m2: null,
    metragem_editada: false,
  };
}

describe("quantificarMateriais — plano (sem geometria de diâmetro)", () => {
  it("isolante/acabamento = área do item × acréscimo, direto (pedido explícito: plano não recalcula por diâmetro)", () => {
    const resultado = quantificarMateriais([plano(10)], 50, parametros);
    expect(resultado.isolanteM2).toBe(11); // 10 × 1.10
    expect(resultado.acabamentoM2).toBe(12); // 10 × 1.20
  });

  it("rebite/parafuso/arame/silicone continuam proporcionais à área de projeto total — mesma lógica de sempre", () => {
    const resultado = quantificarMateriais([plano(10)], 50, parametros);
    expect(resultado.rebiteUn).toBe(200); // 10 × 20
    expect(resultado.parafusoUn).toBe(200);
    expect(resultado.arameMetros).toBe(50); // 10 × 5
    expect(resultado.siliconeFrascos).toBe(5); // 10 ÷ 2
  });

  it("arredonda rebite/parafuso pro inteiro mais próximo (não dá pra comprar fração de unidade)", () => {
    const resultado = quantificarMateriais([plano(3.3)], 50, parametros);
    expect(resultado.rebiteUn).toBe(66); // round(3.3 × 20)
    expect(resultado.parafusoUn).toBe(66);
  });

  it("sem itens de escopo, tudo zero", () => {
    const resultado = quantificarMateriais([], 50, parametros);
    expect(resultado.isolanteM2).toBe(0);
    expect(resultado.acabamentoM2).toBe(0);
    expect(resultado.rebiteUn).toBe(0);
    expect(resultado.parafusoUn).toBe(0);
    expect(resultado.arameMetros).toBe(0);
    expect(resultado.siliconeFrascos).toBe(0);
  });

  it("silicone_intervalo_m2 zerado não gera divisão por zero", () => {
    const resultado = quantificarMateriais([plano(10)], 50, { ...parametros, silicone_intervalo_m2: 0 });
    expect(resultado.siliconeFrascos).toBe(0);
  });
});

describe("quantificarMateriais — tubulação (migração 023: área já isolada)", () => {
  it("isolante/acabamento usam a área do tubo JÁ ISOLADO (diâmetro + 2 espessuras), não a área do tubo nu", () => {
    // Ø100mm, 10m, espessura 50mm → diâmetro isolado = 100 + 2×50 = 200mm = 0,2m
    // área isolada = π × 0,2 × 10 ≈ 6,283 m² (bem maior que a área do tubo nu: π×0,1×10 ≈ 3,1416 m²)
    const resultado = quantificarMateriais([tubulacao(100, 10)], 50, parametros);
    // Área arredondada a 2 casas antes de aplicar o acréscimo (mesmo padrão
    // de `somarMetragemEscopo`).
    const areaIsolada = Number((Math.PI * 0.2 * 10).toFixed(2));
    expect(resultado.isolanteM2).toBeCloseTo(areaIsolada * 1.1, 2);
    expect(resultado.acabamentoM2).toBeCloseTo(areaIsolada * 1.2, 2);
  });

  it("sem espessura (0), a área de isolamento cai de volta na área do tubo nu", () => {
    const resultado = quantificarMateriais([tubulacao(100, 10)], 0, parametros);
    // Área arredondada a 2 casas antes de aplicar o acréscimo (mesmo padrão
    // de `somarMetragemEscopo`) — por isso a comparação usa a área já
    // arredondada, não o valor "puro" de π×0,1×10.
    const areaTuboNuArredondada = Number((Math.PI * 0.1 * 10).toFixed(2));
    expect(resultado.isolanteM2).toBeCloseTo(areaTuboNuArredondada * 1.1, 2);
  });
});

describe("quantificarMateriais — curva (migração 023: mesmo diâmetro já isolado)", () => {
  it("isolante/acabamento usam o diâmetro já isolado, com o mesmo comprimento fixo (Ø × 1,5 × 0,5) de antes", () => {
    // Ø100mm, qtd 2, espessura 50mm → diâmetro isolado 0,2m
    // área = π × 0,2 × 0,75 × 2 ≈ 0,9425 m²
    const resultado = quantificarMateriais([curva(100, 2)], 50, parametros);
    // Área arredondada a 2 casas antes de aplicar o acréscimo — ver
    // comentário no teste de tubulação acima.
    const areaArredondada = Number((Math.PI * 0.2 * 0.75 * 2).toFixed(2));
    expect(resultado.isolanteM2).toBeCloseTo(areaArredondada * 1.1, 2);
  });
});

describe("quantificarMateriais — metragem editada manualmente", () => {
  it("usa a própria área digitada, sem recalcular a partir do diâmetro", () => {
    const item: ItemEscopo = {
      id: "1",
      nome: "Tubo",
      tipo: "tubulacao",
      diametro_mm: 100,
      comprimento_m: 10,
      quantidade: null,
      metragem_manual_m2: 5,
      metragem_editada: true,
    };
    const resultado = quantificarMateriais([item], 50, parametros);
    expect(resultado.isolanteM2).toBe(5.5); // 5 × 1.10, não a área recalculada pela fórmula
  });
});
