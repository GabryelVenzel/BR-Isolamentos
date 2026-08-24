import {
  calcularMetragemCurva,
  calcularMetragemItem,
  calcularMetragemTubulacao,
  metragemFinalItem,
  somarMetragemEscopo,
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
