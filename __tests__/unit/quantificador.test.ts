import { calcularPerimetroTubulacao, quantificarMateriais, somarQuantificacoes } from "@/lib/quantificador";

describe("quantificarMateriais", () => {
  const input = {
    espessura_mm: 51,
    area_m2: 10,
    perimetro_m: 6,
    densidade_manta_kg_m3: 100,
    densidade_chapa_kg_m3: 7850,
    vedacit_gramas_por_junta: 50,
  };

  it("aplica os fatores de perda (20% manta, 30% chapa) do Método Expert", () => {
    const resultado = quantificarMateriais(input);
    const mantaSemFator = (51 / 1000) * 10 * 100;
    const chapaSemFator = (51 / 1000) * 10 * 7850;

    expect(resultado.manta_kg).toBeCloseTo(mantaSemFator * 1.2, 1);
    expect(resultado.chapa_kg).toBeCloseTo(chapaSemFator * 1.3, 1);
  });

  it("calcula rebites/parafusos por m² e arame por m², arredondando para cima", () => {
    const resultado = quantificarMateriais(input);
    expect(resultado.rebites).toBe(Math.ceil(10 * 20));
    expect(resultado.parafusos).toBe(Math.ceil(10 * 20));
    expect(resultado.arame_kg).toBeCloseTo(10 * 0.5, 6);
  });

  it("vedação P.U. a cada 1,5m de perímetro, arredondado para cima", () => {
    const resultado = quantificarMateriais({ ...input, perimetro_m: 4 });
    expect(resultado.vedacao_pu).toBe(Math.ceil(4 / 1.5));
  });
});

describe("somarQuantificacoes", () => {
  it("soma corretamente a quantificação de vários itens de um orçamento misto", () => {
    const item1 = quantificarMateriais({
      espessura_mm: 25,
      area_m2: 5,
      perimetro_m: 3,
      densidade_manta_kg_m3: 100,
      densidade_chapa_kg_m3: 7850,
      vedacit_gramas_por_junta: 50,
    });
    const item2 = quantificarMateriais({
      espessura_mm: 51,
      area_m2: 8,
      perimetro_m: 5,
      densidade_manta_kg_m3: 100,
      densidade_chapa_kg_m3: 7850,
      vedacit_gramas_por_junta: 50,
    });

    const total = somarQuantificacoes([item1, item2]);
    expect(total.manta_kg).toBeCloseTo(item1.manta_kg + item2.manta_kg, 1);
    expect(total.rebites).toBe(item1.rebites + item2.rebites);
  });
});

describe("calcularPerimetroTubulacao", () => {
  it("calcula o perímetro externo do conjunto tubo + isolante", () => {
    // diâmetro externo = 88.9mm + 2*51mm = 190.9mm → perímetro = pi * 0.1909m
    const perimetro = calcularPerimetroTubulacao(88.9, 51);
    expect(perimetro).toBeCloseTo(Math.PI * 0.1909, 4);
  });
});
