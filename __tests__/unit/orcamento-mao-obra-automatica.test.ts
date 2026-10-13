import { calcularMaoObraAutomatica, calcularMaoObraPorItens, type ParametrosMaoObra } from "@/lib/usecases/orcamento/calcularMaoObraAutomatica";

// Fatores padrão do pedido ("Security States Grave"), com a faixa "media"
// (migração 032). Desde a migração 048 este cálculo só mede o TRABALHO do
// trecho (m² equivalentes = metragem ÷ eficiência); horas, dias e valor
// dependem da equipe e ficam em maoObraEquipe.ts.
const parametros: ParametrosMaoObra = {
  eficiencia_tubulacao_pequena: 0.75,
  eficiencia_tubulacao_media: 0.85,
  eficiencia_curva: 0.75,
  eficiencia_altura: 0.5,
  eficiencia_fator_br: 0.8,
};

describe("calcularMaoObraAutomatica", () => {
  it("cenário 1 do pedido: diâmetro grande (>= 6\"), sem altura — eficiência 0.80, 10 m² viram 12,5 m² equivalentes", () => {
    const resultado = calcularMaoObraAutomatica(10, { faixaDiametro: "grande", temCurvas: false, trabalhoAltura: false }, parametros);
    expect(resultado.eficienciaGlobal).toBe(0.8);
    expect(resultado.metragemM2).toBe(10);
    expect(resultado.m2Equivalente).toBe(12.5);
  });

  it("faixa 'media' (3\"–6\") aplica eficiencia_tubulacao_media, não a de 'pequena'", () => {
    const resultado = calcularMaoObraAutomatica(10, { faixaDiametro: "media", temCurvas: false, trabalhoAltura: false }, parametros);
    // 0.85 × 0.8 (fator BR) = 0.68
    expect(resultado.eficienciaGlobal).toBe(0.68);
  });

  it("`null` (só \"plano\", sem tubulação/curva) não penaliza — mesmo efeito de 'grande'", () => {
    const semDiametro = calcularMaoObraAutomatica(10, { faixaDiametro: null, temCurvas: false, trabalhoAltura: false }, parametros);
    const grande = calcularMaoObraAutomatica(10, { faixaDiametro: "grande", temCurvas: false, trabalhoAltura: false }, parametros);
    expect(semDiametro.eficienciaGlobal).toBe(grande.eficienciaGlobal);
  });

  it("cenário 2 do pedido: tubulação < 3\", sem altura — eficiência 0.60, 16,67 m² equivalentes", () => {
    const resultado = calcularMaoObraAutomatica(10, { faixaDiametro: "pequena", temCurvas: false, trabalhoAltura: false }, parametros);
    expect(resultado.eficienciaGlobal).toBe(0.6);
    expect(resultado.m2Equivalente).toBe(16.67);
  });

  it('cenário 3 do pedido: curva < 3" em altura — eficiência 0.225, 44,44 m² equivalentes', () => {
    const resultado = calcularMaoObraAutomatica(10, { faixaDiametro: "pequena", temCurvas: true, trabalhoAltura: true }, parametros);
    expect(resultado.eficienciaGlobal).toBe(0.225);
    expect(resultado.m2Equivalente).toBe(44.44);
  });

  it("os fatores se multiplicam entre si, nunca somam", () => {
    const soAltura = calcularMaoObraAutomatica(10, { faixaDiametro: "grande", temCurvas: false, trabalhoAltura: true }, parametros);
    const tubulacaoECurva = calcularMaoObraAutomatica(10, { faixaDiametro: "pequena", temCurvas: true, trabalhoAltura: false }, parametros);
    const todosOsFatores = calcularMaoObraAutomatica(10, { faixaDiametro: "pequena", temCurvas: true, trabalhoAltura: true }, parametros);
    // 0.75 × 0.75 × 0.50 × 0.80 = 0.225 — bem menor que qualquer fator isolado.
    expect(todosOsFatores.eficienciaGlobal).toBeLessThan(soAltura.eficienciaGlobal);
    expect(todosOsFatores.eficienciaGlobal).toBeLessThan(tubulacaoECurva.eficienciaGlobal);
  });

  it("eficiência zerada não gera divisão por zero — o trabalho fica igual à metragem", () => {
    const resultado = calcularMaoObraAutomatica(10, { faixaDiametro: "grande", temCurvas: false, trabalhoAltura: false }, { ...parametros, eficiencia_fator_br: 0 });
    expect(resultado.m2Equivalente).toBe(10);
  });
});

describe("calcularMaoObraPorItens — eficiência por item (bug relatado: reta + curva dobrava o tempo)", () => {
  // Fatores neutros pra conta redonda: só a curva penaliza (0.5).
  const p: ParametrosMaoObra = {
    eficiencia_tubulacao_pequena: 1,
    eficiencia_tubulacao_media: 1,
    eficiencia_curva: 0.5,
    eficiencia_altura: 1,
    eficiencia_fator_br: 1,
  };

  it("100 m² de reta + 2 m² de curva: só a curva paga o fator de curva", () => {
    const r = calcularMaoObraPorItens(
      [
        { metragemM2: 100, faixaDiametro: "grande", ehCurva: false },
        { metragemM2: 2, faixaDiametro: "grande", ehCurva: true },
      ],
      false,
      p
    );
    // reta: 100; curva: 2 ÷ 0.5 = 4 → 104 (antes: 102 ÷ 0.5 = 204, o dobro)
    expect(r.m2Equivalente).toBe(104);
    expect(r.metragemM2).toBe(102);
  });

  it("cada item usa o próprio diâmetro (reta grossa não herda a penalidade do tubo fino)", () => {
    const r = calcularMaoObraPorItens(
      [
        { metragemM2: 10, faixaDiametro: "grande", ehCurva: false },
        { metragemM2: 10, faixaDiametro: "pequena", ehCurva: false },
      ],
      false,
      { ...p, eficiencia_tubulacao_pequena: 0.5 }
    );
    expect(r.m2Equivalente).toBe(30); // 10 + 10÷0.5
  });

  it("altura vale pro trecho inteiro (todos os itens)", () => {
    const r = calcularMaoObraPorItens([{ metragemM2: 10, faixaDiametro: null, ehCurva: false }], true, { ...p, eficiencia_altura: 0.5 });
    expect(r.m2Equivalente).toBe(20);
  });

  it("trecho de um item só dá o mesmo resultado da função de eficiência única", () => {
    const unico = calcularMaoObraAutomatica(10, { faixaDiametro: "pequena", temCurvas: true, trabalhoAltura: true }, parametros);
    const porItens = calcularMaoObraPorItens([{ metragemM2: 10, faixaDiametro: "pequena", ehCurva: true }], true, parametros);
    expect(porItens.m2Equivalente).toBe(unico.m2Equivalente);
    expect(porItens.eficienciaGlobal).toBe(unico.eficienciaGlobal);
  });

  it("eficiência exibida é a média ponderada (m² ÷ m² equivalentes)", () => {
    const r = calcularMaoObraPorItens(
      [
        { metragemM2: 100, faixaDiametro: "grande", ehCurva: false },
        { metragemM2: 2, faixaDiametro: "grande", ehCurva: true },
      ],
      false,
      p
    );
    expect(r.eficienciaGlobal).toBeCloseTo(102 / 104, 3);
  });
});
