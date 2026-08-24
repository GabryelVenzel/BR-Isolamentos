import { alocarValorFinalPorTrecho, precificarTrecho } from "@/lib/usecases/orcamento/precificarTrecho";
import type { ItemEscopo } from "@/lib/types";

function planoDe(metragem: number): ItemEscopo {
  return {
    id: "1",
    nome: "Item",
    tipo: "plano",
    diametro_mm: null,
    comprimento_m: null,
    quantidade: null,
    metragem_manual_m2: metragem,
    metragem_editada: false,
  };
}

describe("precificarTrecho", () => {
  it("subtotal material = metragem × (preço isolante + preço acabamento)", () => {
    const resultado = precificarTrecho({
      escopoItens: [planoDe(10)],
      precoIsolanteM2: 50,
      precoAcabamentoM2: 85,
      horasMaoObra: 12,
      valorHoraMaoObra: 120,
    });

    expect(resultado.metragem_m2).toBe(10);
    expect(resultado.subtotal_material).toBe(1350); // 10 × 135
    expect(resultado.subtotal_mao_obra).toBe(1440); // 12 × 120
    expect(resultado.subtotal_trecho).toBe(2790);
  });

  it("sem itens de escopo, subtotal material é zero", () => {
    const resultado = precificarTrecho({
      escopoItens: [],
      precoIsolanteM2: 50,
      precoAcabamentoM2: 85,
      horasMaoObra: 0,
      valorHoraMaoObra: 120,
    });
    expect(resultado.subtotal_material).toBe(0);
    expect(resultado.subtotal_trecho).toBe(0);
  });
});

describe("alocarValorFinalPorTrecho", () => {
  it("reparte proporcionalmente ao custo de cada trecho e soma exatamente o valor final", () => {
    const trechos = [
      { subtotal_material: 8505, subtotal_mao_obra: 1440 }, // custo 9945
      { subtotal_material: 4600, subtotal_mao_obra: 960 }, // custo 5560
    ];
    const valores = alocarValorFinalPorTrecho(trechos, 18606);

    expect(valores).toHaveLength(2);
    const soma = Number((valores[0] + valores[1]).toFixed(2));
    expect(soma).toBe(18606);
    // Trecho 1 tem custo maior (9945 vs 5560) — deve receber mais que a metade.
    expect(valores[0]).toBeGreaterThan(valores[1]);
  });

  it("custo total zero não gera divisão por zero — todos os trechos recebem 0", () => {
    const trechos = [
      { subtotal_material: 0, subtotal_mao_obra: 0 },
      { subtotal_material: 0, subtotal_mao_obra: 0 },
    ];
    expect(alocarValorFinalPorTrecho(trechos, 1000)).toEqual([0, 0]);
  });

  it("um único trecho recebe o valor final inteiro", () => {
    const trechos = [{ subtotal_material: 100, subtotal_mao_obra: 0 }];
    expect(alocarValorFinalPorTrecho(trechos, 250.5)).toEqual([250.5]);
  });
});
