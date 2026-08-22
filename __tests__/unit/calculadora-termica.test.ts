import {
  calcularEconomiaECO2,
  calcularEspessuraMinimaCondensacao,
  calcularK,
  calcularPerdaSemIsolante,
  calcularTemperaturaOrvalho,
  encontrarTemperaturaFaceFria,
} from "@/lib/calculadora-termica";

// Fórmula real de lã de rocha cadastrada no sistema (ver
// 2-DocumentaçãoTecnica/materials_internal.py) — usada em todos os testes
// abaixo para não depender de um valor inventado.
const K_LA_DE_ROCHA = "0.031 + 0.00019*T";

describe("calcularK", () => {
  it("avalia a fórmula k(T) corretamente", () => {
    expect(calcularK(K_LA_DE_ROCHA, 100)).toBeCloseTo(0.031 + 0.00019 * 100, 6);
  });

  it("retorna null para fórmula inválida", () => {
    expect(calcularK("isso não é matemática", 100)).toBeNull();
  });

  it("retorna null quando o resultado não é um número finito", () => {
    expect(calcularK("1/0", 100)).toBeNull(); // Infinity não é finito
  });
});

describe("encontrarTemperaturaFaceFria", () => {
  it("converge para uma temperatura de face fria entre a ambiente e a quente (tubulação)", () => {
    const resultado = encontrarTemperaturaFaceFria(
      250, // tQuente
      30, // tAmbiente
      0.051, // 51mm de isolante, em metros
      K_LA_DE_ROCHA,
      "tubulacao",
      0.9, // emissividade
      0.0889 // diâmetro do tubo, em metros (3")
    );

    expect(resultado.convergiu).toBe(true);
    expect(resultado.temperaturaFaceFria).not.toBeNull();
    expect(resultado.temperaturaFaceFria as number).toBeGreaterThan(30);
    expect(resultado.temperaturaFaceFria as number).toBeLessThan(250);
  });

  it("não converge sem diâmetro do tubo para geometria 'tubulacao'", () => {
    const resultado = encontrarTemperaturaFaceFria(250, 30, 0.051, K_LA_DE_ROCHA, "tubulacao", 0.9);
    expect(resultado.convergiu).toBe(false);
    expect(resultado.temperaturaFaceFria).toBeNull();
  });

  it("mais isolante reduz a perda térmica (qTransferencia) em superfície plana", () => {
    const comPouco = encontrarTemperaturaFaceFria(250, 30, 0.025, K_LA_DE_ROCHA, "plana", 0.9);
    const comMuito = encontrarTemperaturaFaceFria(250, 30, 0.1, K_LA_DE_ROCHA, "plana", 0.9);

    expect(comPouco.convergiu).toBe(true);
    expect(comMuito.convergiu).toBe(true);
    expect(comMuito.qTransferencia as number).toBeLessThan(comPouco.qTransferencia as number);
  });
});

describe("calcularPerdaSemIsolante", () => {
  it("aumenta com a diferença de temperatura", () => {
    const perdaMenor = calcularPerdaSemIsolante(100, 30, "plana", 0.9);
    const perdaMaior = calcularPerdaSemIsolante(300, 30, "plana", 0.9);
    expect(perdaMaior).toBeGreaterThan(perdaMenor);
  });
});

describe("calcularTemperaturaOrvalho", () => {
  it("calcula a temperatura de orvalho pela fórmula de Magnus", () => {
    // Valor de referência conhecido: 25°C / 70% UR → ponto de orvalho ≈ 19.1°C
    expect(calcularTemperaturaOrvalho(25, 70)).toBeCloseTo(19.1, 0);
  });
});

describe("calcularEspessuraMinimaCondensacao", () => {
  it("encontra uma espessura que mantém a face fria acima do ponto de orvalho", () => {
    const resultado = calcularEspessuraMinimaCondensacao(
      5, // tInterna (linha de água gelada)
      30, // tAmbiente
      80, // umidadeRelativa
      K_LA_DE_ROCHA,
      "tubulacao",
      0.0889
    );

    expect(resultado.convergiu).toBe(true);
    expect(resultado.espessuraMinimaMm).not.toBeNull();
    expect(resultado.espessuraMinimaMm as number).toBeGreaterThan(0);
  });
});

describe("calcularEconomiaECO2", () => {
  it("calcula economia positiva quando o isolante reduz a perda térmica", () => {
    const resultado = calcularEconomiaECO2(
      0.5, // perdaComIsolanteKwM2
      2.0, // perdaSemIsolanteKwM2
      "eletricidade",
      0.75,
      10, // areaM2
      8, // horasOperacaoDia
      5 // diasOperacaoSemana
    );

    expect(resultado.economiaMensal).toBeGreaterThan(0);
    expect(resultado.economiaAnual).toBeCloseTo(resultado.economiaMensal * 12, 6);
    expect(resultado.reducaoPercentual).toBeCloseTo(75, 6); // (2 - 0.5) / 2 * 100
    expect(resultado.co2TonAno).toBeGreaterThan(0);
  });
});
