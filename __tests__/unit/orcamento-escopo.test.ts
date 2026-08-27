import {
  areaBaseIsolamentoEscopo,
  areaBaseIsolamentoItem,
  calcularMetragemCurva,
  calcularMetragemItem,
  calcularMetragemTubulacao,
  metragemFinalItem,
  quantidadeEscopoItem,
  somarMetragemEscopo,
  temCurvasNoEscopo,
  temTubulacaoPequena,
} from "@/lib/usecases/orcamento/escopo";
import type { ItemEscopo } from "@/lib/types";

function item(overrides: Partial<ItemEscopo> = {}): ItemEscopo {
  return {
    id: "1",
    nome: "Item",
    tipo: "tubulacao",
    diametro_mm: 100,
    comprimento_m: 15,
    quantidade: null,
    metragem_manual_m2: null,
    metragem_editada: false,
    ...overrides,
  };
}

describe("calcularMetragemTubulacao", () => {
  it("metragem = π × diâmetro(m) × comprimento(m)", () => {
    // Ø100mm, 15m → π × 0,1 × 15 ≈ 4,712 m²
    expect(calcularMetragemTubulacao(100, 15)).toBeCloseTo(4.712, 2);
  });
});

describe("calcularMetragemCurva", () => {
  it("metragem/curva = π × diâmetro(m) × 1,5 × 0,5; total = × quantidade", () => {
    // Ø100mm → π × 0,1 × 0,75 ≈ 0,2356 m²/curva; qtd 2 → 0,4712 m²
    expect(calcularMetragemCurva(100, 2)).toBeCloseTo(0.4712, 3);
  });

  it("quantidade zero dá metragem zero", () => {
    expect(calcularMetragemCurva(100, 0)).toBe(0);
  });
});

describe("calcularMetragemItem / metragemFinalItem", () => {
  it("plano usa sempre a entrada manual, mesmo sem metragem_editada marcado", () => {
    const plano = item({ tipo: "plano", diametro_mm: null, comprimento_m: null, metragem_manual_m2: 10 });
    expect(calcularMetragemItem(plano)).toBe(10);
    expect(metragemFinalItem(plano)).toBe(10);
  });

  it("tubulação usa a fórmula quando metragem_editada é false", () => {
    const tubo = item({ metragem_editada: false, metragem_manual_m2: 999 });
    expect(metragemFinalItem(tubo)).toBeCloseTo(4.712, 2);
  });

  it("tubulação usa o valor manual quando metragem_editada é true (override)", () => {
    const tubo = item({ metragem_editada: true, metragem_manual_m2: 50 });
    expect(metragemFinalItem(tubo)).toBe(50);
  });

  it("curva usa a fórmula quando metragem_editada é false", () => {
    const curva = item({ tipo: "curva", diametro_mm: 100, quantidade: 2, comprimento_m: null });
    expect(metragemFinalItem(curva)).toBeCloseTo(0.4712, 3);
  });
});

describe("somarMetragemEscopo", () => {
  it("soma a metragem final de todos os itens (mistura fórmula + override + manual)", () => {
    const itens: ItemEscopo[] = [
      item({ id: "1", tipo: "tubulacao", diametro_mm: 100, comprimento_m: 15 }), // ≈4,712
      item({ id: "2", tipo: "curva", diametro_mm: 100, quantidade: 2, comprimento_m: null }), // ≈0,4712
      item({ id: "3", tipo: "plano", diametro_mm: null, comprimento_m: null, metragem_manual_m2: 10 }), // 10
    ];
    expect(somarMetragemEscopo(itens)).toBeCloseTo(15.18, 1);
  });

  it("lista vazia soma zero", () => {
    expect(somarMetragemEscopo([])).toBe(0);
  });
});

// Migração 019: "tem curvas"/"tubulação pequena" são derivadas do Escopo já
// existente, não campos manuais novos — ver decisão 2 em
// sql-migration-019-motor-quantificacao-mao-obra.sql.
describe("temCurvasNoEscopo", () => {
  it("true se há qualquer item do tipo curva", () => {
    expect(temCurvasNoEscopo([item({ tipo: "curva", quantidade: 2 })])).toBe(true);
  });

  it("false se só há tubulação/plano", () => {
    expect(temCurvasNoEscopo([item({ tipo: "tubulacao" }), item({ tipo: "plano", metragem_manual_m2: 5 })])).toBe(false);
  });

  it("lista vazia é false", () => {
    expect(temCurvasNoEscopo([])).toBe(false);
  });
});

describe("temTubulacaoPequena", () => {
  it("true se alguma tubulação/curva tem diâmetro < 101,6mm (4 polegadas)", () => {
    expect(temTubulacaoPequena([item({ tipo: "tubulacao", diametro_mm: 80 })])).toBe(true);
    expect(temTubulacaoPequena([item({ tipo: "curva", diametro_mm: 50, quantidade: 2 })])).toBe(true);
  });

  it("false se diâmetro >= 101,6mm", () => {
    expect(temTubulacaoPequena([item({ tipo: "tubulacao", diametro_mm: 150 })])).toBe(false);
  });

  it("itens 'plano' (sem diâmetro) nunca contam como tubulação pequena", () => {
    expect(temTubulacaoPequena([item({ tipo: "plano", diametro_mm: null, metragem_manual_m2: 5 })])).toBe(false);
  });

  it("lista vazia é false", () => {
    expect(temTubulacaoPequena([])).toBe(false);
  });
});

describe("quantidadeEscopoItem", () => {
  it("tubulação: comprimento em metros", () => {
    expect(quantidadeEscopoItem(item({ tipo: "tubulacao", comprimento_m: 25 }))).toBe("25 m");
  });

  it("curva: quantidade em unidades", () => {
    expect(quantidadeEscopoItem(item({ tipo: "curva", quantidade: 2 }))).toBe("2 un.");
  });

  it("plano: sempre \"1\" (não tem quantidade física própria)", () => {
    expect(quantidadeEscopoItem(item({ tipo: "plano", metragem_manual_m2: 5 }))).toBe("1");
  });
});

describe("areaBaseIsolamentoItem (migração 023)", () => {
  it("tubulação: usa o diâmetro + 2 espessuras de isolante, maior que a área do tubo nu", () => {
    // Ø100mm, 10m, espessura 50mm → diâmetro isolado 200mm = 0,2m
    const area = areaBaseIsolamentoItem(item({ tipo: "tubulacao", diametro_mm: 100, comprimento_m: 10 }), 50);
    expect(area).toBeCloseTo(Math.PI * 0.2 * 10, 4);
    expect(area).toBeGreaterThan(calcularMetragemTubulacao(100, 10));
  });

  it("tubulação com espessura 0 é igual à área do tubo nu", () => {
    const area = areaBaseIsolamentoItem(item({ tipo: "tubulacao", diametro_mm: 100, comprimento_m: 10 }), 0);
    expect(area).toBeCloseTo(calcularMetragemTubulacao(100, 10), 4);
  });

  it("curva: mesmo comprimento fixo (Ø × 1,5 × 0,5) da fórmula original, com o diâmetro isolado", () => {
    const area = areaBaseIsolamentoItem(item({ tipo: "curva", diametro_mm: 100, quantidade: 2 }), 50);
    expect(area).toBeCloseTo(Math.PI * 0.2 * 0.75 * 2, 4);
    expect(area).toBeGreaterThan(calcularMetragemCurva(100, 2));
  });

  it("plano: não cresce com a espessura, usa a própria área do item", () => {
    const area = areaBaseIsolamentoItem(item({ tipo: "plano", metragem_manual_m2: 7 }), 50);
    expect(area).toBe(7);
  });

  it("metragem editada manualmente: usa a área digitada, não recalcula pelo diâmetro", () => {
    const area = areaBaseIsolamentoItem(
      item({ tipo: "tubulacao", diametro_mm: 100, comprimento_m: 10, metragem_editada: true, metragem_manual_m2: 3 }),
      50
    );
    expect(area).toBe(3);
  });
});

describe("areaBaseIsolamentoEscopo", () => {
  it("soma a área base de todos os itens do trecho", () => {
    const total = areaBaseIsolamentoEscopo(
      [item({ tipo: "tubulacao", diametro_mm: 100, comprimento_m: 10 }), item({ tipo: "plano", metragem_manual_m2: 5 })],
      50
    );
    expect(total).toBeCloseTo(Math.PI * 0.2 * 10 + 5, 2);
  });

  it("lista vazia dá zero", () => {
    expect(areaBaseIsolamentoEscopo([], 50)).toBe(0);
  });
});
