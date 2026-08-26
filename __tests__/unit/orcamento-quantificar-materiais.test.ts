import { quantificarMateriais, type ParametrosQuantificacao } from "@/lib/usecases/orcamento/quantificarMateriais";

// Parâmetros padrão do pedido ("Security States Grave").
const parametros: ParametrosQuantificacao = {
  isolante_acrescimo_percentual: 20,
  acabamento_acrescimo_percentual: 30,
  rebite_por_m2: 20,
  parafusos_por_m2: 20,
  arame_gramas_por_m2: 500,
  silicone_intervalo_m2: 2,
};

describe("quantificarMateriais", () => {
  it("reproduz exatamente a tabela de exemplo do pedido (10 m²)", () => {
    const resultado = quantificarMateriais(10, parametros);

    expect(resultado.isolanteM2).toBe(12); // 10 × 1.20
    expect(resultado.acabamentoM2).toBe(13); // 10 × 1.30
    expect(resultado.rebiteUn).toBe(200); // 10 × 20
    expect(resultado.parafusoUn).toBe(200); // 10 × 20
    expect(resultado.arameGramas).toBe(5000); // 10 × 500
    expect(resultado.siliconeFrascos).toBe(5); // (10 ÷ 2) × 1
  });

  it("arredonda rebite/parafuso pro inteiro mais próximo (não dá pra comprar fração de unidade)", () => {
    const resultado = quantificarMateriais(3.3, parametros);
    expect(resultado.rebiteUn).toBe(66); // round(3.3 × 20 = 66)
    expect(resultado.parafusoUn).toBe(66);
  });

  it("metragem zero produz quantidades zero em tudo", () => {
    const resultado = quantificarMateriais(0, parametros);
    expect(resultado.isolanteM2).toBe(0);
    expect(resultado.acabamentoM2).toBe(0);
    expect(resultado.rebiteUn).toBe(0);
    expect(resultado.parafusoUn).toBe(0);
    expect(resultado.arameGramas).toBe(0);
    expect(resultado.siliconeFrascos).toBe(0);
  });

  it("silicone_intervalo_m2 zerado não gera divisão por zero", () => {
    const resultado = quantificarMateriais(10, { ...parametros, silicone_intervalo_m2: 0 });
    expect(resultado.siliconeFrascos).toBe(0);
  });
});
