import { comporCamadasIsolante, espessuraTotalComposicao } from "@/lib/usecases/orcamento/composicaoIsolante";

describe("comporCamadasIsolante", () => {
  it("espessura exata de uma única espessura disponível vira 1 camada", () => {
    expect(comporCamadasIsolante(25, [25, 50])).toEqual([{ espessuraMm: 25, quantidadeCamadas: 1 }]);
  });

  it("75mm de Lã de Rocha (25/50 disponíveis) vira 50mm + 25mm — exemplo do pedido", () => {
    expect(comporCamadasIsolante(75, [50, 25])).toEqual([
      { espessuraMm: 50, quantidadeCamadas: 1 },
      { espessuraMm: 25, quantidadeCamadas: 1 },
    ]);
  });

  it("100mm de Fibra Cerâmica (25/50 disponíveis) vira 2 camadas de 50mm — exemplo do pedido", () => {
    expect(comporCamadasIsolante(100, [25, 50])).toEqual([{ espessuraMm: 50, quantidadeCamadas: 2 }]);
  });

  it("36mm no frio (18/25 disponíveis) vira 2x18mm exato, não 2x25 nem 25+18", () => {
    expect(comporCamadasIsolante(36, [18, 25])).toEqual([{ espessuraMm: 18, quantidadeCamadas: 2 }]);
  });

  it("43mm no frio vira 25mm + 18mm exato", () => {
    expect(comporCamadasIsolante(43, [18, 25])).toEqual([
      { espessuraMm: 25, quantidadeCamadas: 1 },
      { espessuraMm: 18, quantidadeCamadas: 1 },
    ]);
  });

  it("50mm no frio vira 2x25mm exato", () => {
    expect(comporCamadasIsolante(50, [18, 25])).toEqual([{ espessuraMm: 25, quantidadeCamadas: 2 }]);
  });

  it("família com uma única espessura padrão sempre arredonda pra cima (nunca fica abaixo do exigido)", () => {
    // Manta de Lã de Rocha com Tela só existe em 50mm — exigido 30mm não pode
    // virar uma camada mais fina que a única opção do catálogo.
    expect(comporCamadasIsolante(30, [50])).toEqual([{ espessuraMm: 50, quantidadeCamadas: 1 }]);
    expect(comporCamadasIsolante(60, [50])).toEqual([{ espessuraMm: 50, quantidadeCamadas: 2 }]);
  });

  it("nunca soma menos que a espessura exigida (arredondamento sempre pra cima)", () => {
    const camadas = comporCamadasIsolante(80, [50, 25]); // 75 < 80 < 100
    expect(espessuraTotalComposicao(camadas)).toBeGreaterThanOrEqual(80);
    expect(espessuraTotalComposicao(camadas)).toBe(100); // 50+50, menor soma alcançável >= 80
  });

  it("espessura fracionária (cálculo térmico) arredonda pra cima antes de compor", () => {
    // 24,3mm exigido -> arredonda pra 25mm exigido -> 1 camada de 25mm.
    expect(comporCamadasIsolante(24.3, [18, 25])).toEqual([{ espessuraMm: 25, quantidadeCamadas: 1 }]);
  });

  it("espessura exigida <= 0 ou sem espessuras disponíveis retorna vazio", () => {
    expect(comporCamadasIsolante(0, [25, 50])).toEqual([]);
    expect(comporCamadasIsolante(-5, [25, 50])).toEqual([]);
    expect(comporCamadasIsolante(75, [])).toEqual([]);
  });
});

describe("espessuraTotalComposicao", () => {
  it("soma quantidadeCamadas x espessuraMm de cada camada", () => {
    expect(
      espessuraTotalComposicao([
        { espessuraMm: 50, quantidadeCamadas: 2 },
        { espessuraMm: 25, quantidadeCamadas: 1 },
      ])
    ).toBe(125);
    expect(espessuraTotalComposicao([])).toBe(0);
  });
});
