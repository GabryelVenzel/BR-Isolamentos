import { brutoParaLiquido, encargosDaPessoa, parametrosEncargosDaConfig, retencoesDoBruto } from "@/lib/usecases/orcamento/encargosMaoObra";

// Critérios de aceite do documento "Direcionamento_Encargos_Mao_de_Obra_Orcamento.docx" (item 7).
// Os números do documento foram calculados com ISS 0%.
const anexoIII = parametrosEncargosDaConfig({ regime_tributario: "simples_nacional", simples_nacional_anexo: "III", encargos_iss_autonomo_pct: 0 });
const anexoIV = parametrosEncargosDaConfig({ regime_tributario: "simples_nacional", simples_nacional_anexo: "IV", encargos_iss_autonomo_pct: 0 });

describe("encargos da mão de obra (migração 056)", () => {
  it("MEI, R$ 550, 5 dias: custo = valor combinado, sem encargos", () => {
    const r = encargosDaPessoa("mei", 550, 5, anexoIII);
    expect(r).toMatchObject({ valor_pago: 2750, custo_real: 2750, inss: 0, irrf: 0, cpp: 0 });
  });

  // Cálculo de UM MÊS (documento, item 5): bruto a partir do líquido do mês.
  it.each([
    [2750, 3089.89, 339.89, 0], // 5 diárias
    [5500, 7054.51, 776, 778.51], // 10 diárias — redução da Lei 15.270
    [11000, 14851.3, 932.31, 2918.99], // 20 diárias — teto do INSS
  ])("mês com líquido de %s: bruto %s, INSS %s, IR %s", (liquido, bruto, inss, irrf) => {
    expect(brutoParaLiquido(liquido, anexoIII)).toBe(bruto);
    expect(retencoesDoBruto(bruto, anexoIII)).toMatchObject({ inss, irrf, liquido });
  });

  // Regra do orçamento (decisão do usuário): a diária da PF custa SEMPRE o de
  // um mês cheio (22 diárias), mesmo numa obra curta.
  const mesCheio = brutoParaLiquido(22 * 550, anexoIII); // bruto de 22 diárias no mês
  const porDiaria = mesCheio / 22;

  it("PF, 5 dias: cobra cada diária pelo custo de um mês cheio (mais caro que 5 dias isolados)", () => {
    const r = encargosDaPessoa("pf", 550, 5, anexoIII);
    expect(r.bruto).toBe(Math.round(porDiaria * 5 * 100) / 100);
    expect(r.bruto).toBeGreaterThan(3089.89); // 5 diárias isoladas no mês
    expect(r.valor_pago).toBe(2750);
  });

  it("PF, 22 dias: exatamente o mês cheio", () => {
    const r = encargosDaPessoa("pf", 550, 22, anexoIII);
    expect(r.bruto).toBe(mesCheio);
    expect(r.inss).toBe(932.31);
  });

  it("PF, 30 dias: 30 diárias ao custo da diária do mês cheio", () => {
    expect(encargosDaPessoa("pf", 550, 30, anexoIII).bruto).toBe(Math.round(porDiaria * 30 * 100) / 100);
  });

  it("Anexo IV: + 20% patronal sobre o bruto (20 diárias: bruto do mês cheio × 20/22)", () => {
    const r = encargosDaPessoa("pf", 550, 20, anexoIV);
    expect(r.cpp).toBe(Math.round(porDiaria * 0.2 * 20 * 100) / 100);
    expect(r.custo_real).toBe(Math.round((r.bruto + r.cpp) * 100) / 100);
  });

  it("o custo por diária não depende da duração da obra", () => {
    const d5 = encargosDaPessoa("pf", 550, 5, anexoIII).custo_real / 5;
    const d15 = encargosDaPessoa("pf", 550, 15, anexoIII).custo_real / 15;
    expect(Math.abs(d5 - d15)).toBeLessThan(0.01);
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

  it("ISS de 5% (teto, padrão): retido da PF — o bruto sobe para o líquido continuar o combinado", () => {
    const comIss = parametrosEncargosDaConfig({ simples_nacional_anexo: "III" });
    expect(comIss.iss_autonomo_pct).toBe(5);
    const r = encargosDaPessoa("pf", 550, 22, comIss);
    expect(r.iss).toBe(Math.round(r.bruto * 5) / 100);
    expect(Math.round((r.bruto - r.inss - r.irrf - r.iss) * 100) / 100).toBe(12100);
    expect(r.bruto).toBeGreaterThan(mesCheio);
    // MEI e PJ não sofrem retenção de ISS pela BR.
    expect(encargosDaPessoa("mei", 550, 5, comIss).iss).toBe(0);
  });

  it("fora do Simples a PF também gera INSS patronal", () => {
    const presumido = parametrosEncargosDaConfig({ regime_tributario: "lucro_presumido" });
    expect(encargosDaPessoa("pf", 550, 5, presumido).cpp).toBeGreaterThan(0);
  });
});
