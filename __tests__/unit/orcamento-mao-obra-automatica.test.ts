import { calcularMaoObraAutomatica, type ParametrosMaoObra } from "@/lib/usecases/orcamento/calcularMaoObraAutomatica";

// Parâmetros padrão do pedido ("Security States Grave").
const parametros: ParametrosMaoObra = {
  m2_por_hora_dupla: 2,
  eficiencia_tubulacao_pequena: 0.75,
  eficiencia_curva: 0.75,
  eficiencia_altura: 0.5,
  eficiencia_fator_br: 0.8,
  horas_uteis_dia: 9,
};

describe("calcularMaoObraAutomatica", () => {
  it("cenário 1 do pedido: reta > 4\", sem altura — eficiência 0.80, 6.25h, 0.69 dias", () => {
    const resultado = calcularMaoObraAutomatica(
      10,
      { tubulacaoPequena: false, temCurvas: false, trabalhoAltura: false },
      parametros
    );
    expect(resultado.eficienciaGlobal).toBe(0.8);
    expect(resultado.horasBase).toBe(5);
    expect(resultado.horasAjustadas).toBe(6.25);
    expect(resultado.diasNecessarios).toBe(0.69);
  });

  it("cenário 2 do pedido: tubulação < 4\", sem altura — eficiência 0.60, 8.33h, 0.93 dias", () => {
    const resultado = calcularMaoObraAutomatica(
      10,
      { tubulacaoPequena: true, temCurvas: false, trabalhoAltura: false },
      parametros
    );
    expect(resultado.eficienciaGlobal).toBe(0.6);
    expect(resultado.horasAjustadas).toBe(8.33);
    expect(resultado.diasNecessarios).toBe(0.93);
  });

  it("cenário 3 do pedido: curva < 4\" em altura — eficiência 0.225, 22.22h, 2.47 dias", () => {
    const resultado = calcularMaoObraAutomatica(
      10,
      { tubulacaoPequena: true, temCurvas: true, trabalhoAltura: true },
      parametros
    );
    expect(resultado.eficienciaGlobal).toBe(0.225);
    expect(resultado.horasAjustadas).toBe(22.22);
    expect(resultado.diasNecessarios).toBe(2.47);
  });

  it("os fatores se multiplicam entre si, nunca somam", () => {
    const soAltura = calcularMaoObraAutomatica(
      10,
      { tubulacaoPequena: false, temCurvas: false, trabalhoAltura: true },
      parametros
    );
    const tubulacaoECurva = calcularMaoObraAutomatica(
      10,
      { tubulacaoPequena: true, temCurvas: true, trabalhoAltura: false },
      parametros
    );
    const todosOsFatores = calcularMaoObraAutomatica(
      10,
      { tubulacaoPequena: true, temCurvas: true, trabalhoAltura: true },
      parametros
    );
    // 0.75 × 0.75 × 0.50 × 0.80 = 0.225 — bem menor que qualquer fator isolado.
    expect(todosOsFatores.eficienciaGlobal).toBeLessThan(soAltura.eficienciaGlobal);
    expect(todosOsFatores.eficienciaGlobal).toBeLessThan(tubulacaoECurva.eficienciaGlobal);
  });

  it("m2_por_hora_dupla zerado não gera divisão por zero", () => {
    const resultado = calcularMaoObraAutomatica(
      10,
      { tubulacaoPequena: false, temCurvas: false, trabalhoAltura: false },
      { ...parametros, m2_por_hora_dupla: 0 }
    );
    expect(resultado.horasBase).toBe(0);
  });
});
