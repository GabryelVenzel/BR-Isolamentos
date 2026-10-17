import { brutoParaLiquido, encargosDaPessoa, parametrosEncargosDaConfig, retencoesDoBruto } from "@/lib/usecases/orcamento/encargosMaoObra";

// Critérios de aceite do documento "Direcionamento_Encargos_Mao_de_Obra_Orcamento.docx" (item 7).
const anexoIII = parametrosEncargosDaConfig({ regime_tributario: "simples_nacional", simples_nacional_anexo: "III" });
const anexoIV = parametrosEncargosDaConfig({ regime_tributario: "simples_nacional", simples_nacional_anexo: "IV" });

describe("encargos da mão de obra (migração 056)", () => {
  it("MEI, R$ 550, 5 dias: custo = valor combinado, sem encargos", () => {
    const r = encargosDaPessoa("mei", 550, 5, anexoIII);
    expect(r).toMatchObject({ valor_pago: 2750, custo_real: 2750, inss: 0, irrf: 0, cpp: 0 });
  });

  it("PF, R$ 550, 5 dias, Anexo III: bruto 3.089,89; INSS 339,89; IR 0", () => {
    const r = encargosDaPessoa("pf", 550, 5, anexoIII);
    expect(r).toMatchObject({ bruto: 3089.89, inss: 339.89, irrf: 0, cpp: 0, custo_real: 3089.89 });
  });

  it("PF, R$ 550, 10 dias: redução da Lei 15.270 (bruto 7.054,51; IR 778,51)", () => {
    const r = encargosDaPessoa("pf", 550, 10, anexoIII);
    expect(r).toMatchObject({ bruto: 7054.51, inss: 776, irrf: 778.51 });
  });

  it("PF, R$ 550, 20 dias, Anexo III: bruto 14.851,30; INSS 932,31 (teto); IR 2.918,99", () => {
    const r = encargosDaPessoa("pf", 550, 20, anexoIII);
    expect(r).toMatchObject({ bruto: 14851.3, inss: 932.31, irrf: 2918.99, custo_real: 14851.3 });
  });

  it("mesmo cenário no Anexo IV: custo 17.821,56 (bruto + 20% patronal)", () => {
    const r = encargosDaPessoa("pf", 550, 20, anexoIV);
    expect(r.custo_real).toBe(17821.56);
    expect(r.cpp).toBe(2970.26);
  });

  it("PF, 30 dias: blocos de 22 + 8, cada mês calculado separadamente", () => {
    const r = encargosDaPessoa("pf", 550, 30, anexoIII);
    const b22 = brutoParaLiquido(22 * 550, anexoIII);
    const b8 = brutoParaLiquido(8 * 550, anexoIII);
    expect(r.bruto).toBe(Math.round((b22 + b8) * 100) / 100);
  });

  it("o bruto sempre deixa pelo menos o líquido combinado na mão", () => {
    for (const liquido of [100, 2750, 4400, 5500, 8250, 11000, 30000]) {
      const b = brutoParaLiquido(liquido, anexoIII);
      expect(Math.round(retencoesDoBruto(b, anexoIII).liquido * 100) / 100).toBeGreaterThanOrEqual(liquido);
      expect(Math.round(retencoesDoBruto(b - 0.01, anexoIII).liquido * 100) / 100).toBeLessThan(liquido);
    }
  });

  it("MEI com INSS patronal: +20% sobre o valor da nota", () => {
    expect(encargosDaPessoa("mei_cpp", 550, 5, anexoIII)).toMatchObject({ cpp: 550, custo_real: 3300 });
  });

  it("PJ e forma não informada (orçamento antigo): sem encargos", () => {
    expect(encargosDaPessoa("pj", 400, 5, anexoIV).custo_real).toBe(2000);
    expect(encargosDaPessoa("nao_informada", 400, 5, anexoIV).custo_real).toBe(2000);
  });

  it("redução desligada nas configurações: IR só pela tabela", () => {
    const semReducao = parametrosEncargosDaConfig({ simples_nacional_anexo: "III", encargos_reducao_irrf: { ativa: false } as never });
    const r = encargosDaPessoa("pf", 550, 5, semReducao);
    expect(r.irrf).toBeGreaterThan(0);
  });

  it("fora do Simples a PF também gera INSS patronal", () => {
    const presumido = parametrosEncargosDaConfig({ regime_tributario: "lucro_presumido" });
    expect(encargosDaPessoa("pf", 550, 5, presumido).cpp).toBeGreaterThan(0);
  });
});
