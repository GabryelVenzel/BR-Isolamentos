import { calcularAliquotaSimplesNacional } from "@/lib/tributos";

// Regressão importante: o cálculo de impostos do orçamento SEMPRE usa a
// alíquota EFETIVA (fórmula oficial da LC 123/2006), nunca a alíquota
// nominal da faixa — ver `lib/tributos.ts` e a memória do projeto sobre
// "carga tributária real e completa".
describe("calcularAliquotaSimplesNacional", () => {
  it("retorna null para RBT12 inválido (zero, negativo ou acima do teto)", () => {
    expect(calcularAliquotaSimplesNacional(0, "IV")).toBeNull();
    expect(calcularAliquotaSimplesNacional(-100, "IV")).toBeNull();
    expect(calcularAliquotaSimplesNacional(5_000_000, "IV")).toBeNull();
  });

  it("Anexo IV, 1ª faixa: alíquota efetiva == alíquota nominal (sem parcela a deduzir)", () => {
    const resultado = calcularAliquotaSimplesNacional(150_000, "IV");
    expect(resultado).not.toBeNull();
    expect(resultado!.aliquotaNominalPercentual).toBeCloseTo(4.5, 6);
    expect(resultado!.valorADeduzir).toBe(0);
    expect(resultado!.aliquotaEfetivaPercentual).toBeCloseTo(4.5, 6);
  });

  it("Anexo IV, 2ª faixa: alíquota efetiva é MENOR que a nominal (parcela a deduzir aplicada)", () => {
    // RBT12 = 300.000 → nominal 9% (0.09), valorADeduzir 8.100
    // efetiva = (300000*0.09 - 8100) / 300000 = 0.063 = 6.3%
    const resultado = calcularAliquotaSimplesNacional(300_000, "IV");
    expect(resultado).not.toBeNull();
    expect(resultado!.aliquotaNominalPercentual).toBeCloseTo(9, 6);
    expect(resultado!.aliquotaEfetivaPercentual).toBeCloseTo(6.3, 6);
    expect(resultado!.aliquotaEfetivaPercentual).toBeLessThan(resultado!.aliquotaNominalPercentual);
  });

  it("Anexo III tem alíquota efetiva diferente do Anexo IV para o mesmo RBT12", () => {
    const anexoIII = calcularAliquotaSimplesNacional(300_000, "III");
    const anexoIV = calcularAliquotaSimplesNacional(300_000, "IV");
    expect(anexoIII!.aliquotaEfetivaPercentual).not.toBeCloseTo(anexoIV!.aliquotaEfetivaPercentual, 6);
  });

  it("nunca retorna alíquota efetiva negativa", () => {
    const resultado = calcularAliquotaSimplesNacional(180_001, "IV");
    expect(resultado!.aliquotaEfetivaPercentual).toBeGreaterThanOrEqual(0);
  });
});
