import { ValidationError } from "@/lib/errors";
import { calcularEconomia, calcularFrio, calcularQuente } from "@/lib/usecases/engenharia";
import type { Acabamento, MaterialIsolante } from "@/lib/types";

// Material com k(T) constante — facilita prever o resultado sem duplicar a
// física em cada teste (o objetivo aqui é testar a CAMADA DE USE CASE:
// validação, roteamento de parâmetros, hardcode de vento — não redemonstrar
// a convergência térmica, já coberta em __tests__/unit/calculadora-termica.test.ts).
const MATERIAL_FAKE: MaterialIsolante = {
  id: 1,
  nome: "Material Teste",
  k_func: "0.05",
  t_min: -50,
  t_max: 900,
  densidade_kg_m3: 100,
  categoria: null,
  ativo: true,
};

const ACABAMENTO_FAKE: Acabamento = { id: 1, nome: "Acabamento Teste", emissividade: 0.9, ativo: true };

describe("calcularQuente", () => {
  const inputBase = {
    material_id: 1,
    acabamento_id: 1,
    geometria: "plana" as const,
    espessura_mm: 50,
    temperatura_quente: 200,
    temperatura_ambiente: 30,
  };

  it("nunca usa velocidade de vento — mesmo resultado independente de qualquer campo de vento no input", () => {
    // O painel Quente não tem campo de vento no formulário (Mudança 2), mas
    // mesmo que um valor de vento vazasse no payload (bug futuro), o use
    // case não deve lê-lo — ele nem está no schema.
    const resultado1 = calcularQuente(inputBase, { material: MATERIAL_FAKE, acabamento: ACABAMENTO_FAKE });
    const resultado2 = calcularQuente(
      { ...inputBase, velocidade_vento_ms: 15 } as unknown,
      { material: MATERIAL_FAKE, acabamento: ACABAMENTO_FAKE }
    );

    expect(resultado2).toEqual(resultado1);
  });

  it("perda térmica sem isolante é maior que com isolante", () => {
    const resultado = calcularQuente(inputBase, { material: MATERIAL_FAKE, acabamento: ACABAMENTO_FAKE });
    expect(resultado.perda_sem_isolante_kw_m2).toBeGreaterThan(resultado.perda_com_isolante_kw_m2);
  });

  it("rejeita temperatura quente menor ou igual à ambiente", () => {
    expect(() =>
      calcularQuente(
        { ...inputBase, temperatura_quente: 20, temperatura_ambiente: 30 },
        { material: MATERIAL_FAKE, acabamento: ACABAMENTO_FAKE }
      )
    ).toThrow(ValidationError);
  });

  it("rejeita temperatura fora da faixa do material selecionado", () => {
    expect(() =>
      calcularQuente(
        { ...inputBase, temperatura_quente: 1000 },
        { material: MATERIAL_FAKE, acabamento: ACABAMENTO_FAKE }
      )
    ).toThrow(ValidationError);
  });

  it("exige diâmetro para geometria tubulação", () => {
    expect(() =>
      calcularQuente(
        { ...inputBase, geometria: "tubulacao" },
        { material: MATERIAL_FAKE, acabamento: ACABAMENTO_FAKE }
      )
    ).toThrow(ValidationError);
  });
});

describe("calcularFrio", () => {
  const inputBase = {
    material_id: 1,
    geometria: "plana" as const,
    temperatura_interna: 5,
    temperatura_ambiente: 30,
    umidade_relativa: 70,
    velocidade_vento_ms: 0,
  };

  it("aceita temperatura interna negativa (linha de água gelada)", () => {
    const resultado = calcularFrio({ ...inputBase, temperatura_interna: -10, temperatura_ambiente: 25 }, { material: MATERIAL_FAKE });
    expect(resultado.espessura_minima_mm).toBeGreaterThan(0);
  });

  it("rejeita temperatura ambiente menor ou igual à interna", () => {
    expect(() =>
      calcularFrio({ ...inputBase, temperatura_ambiente: 5, temperatura_interna: 5 }, { material: MATERIAL_FAKE })
    ).toThrow(ValidationError);
  });

  it("temperatura de orvalho calculada é menor que a temperatura ambiente", () => {
    const resultado = calcularFrio(inputBase, { material: MATERIAL_FAKE });
    expect(resultado.temperatura_orvalho).toBeLessThan(inputBase.temperatura_ambiente);
  });

  it("velocidade do vento diferente de zero muda o resultado (campo é usado, ao contrário do painel Quente)", () => {
    const semVento = calcularFrio({ ...inputBase, velocidade_vento_ms: 0 }, { material: MATERIAL_FAKE });
    const comVento = calcularFrio({ ...inputBase, velocidade_vento_ms: 5 }, { material: MATERIAL_FAKE });
    expect(comVento.espessura_minima_mm).not.toBe(semVento.espessura_minima_mm);
  });
});

describe("calcularEconomia", () => {
  // horas/dia + dias/semana (não "horas/ano" direto) — mesmo padrão do
  // wizard de orçamento. calcularEconomiaECO2 converte pra mensal via
  // ×4.33 (semanas/mês médias) e depois ×12 pro anual.
  const inputBase = {
    perda_com_isolante_kw_m2: 0.5,
    perda_sem_isolante_kw_m2: 2.0,
    area_m2: 10,
    combustivel: "eletricidade" as const,
    custo_combustivel: 0.75,
    horas_operacao_dia: 24,
    dias_operacao_semana: 7,
  };

  it("economia de energia é a diferença de perda × área × horas/dia × dias/semana × 4.33 × 12", () => {
    const resultado = calcularEconomia(inputBase);
    const esperadoKwh = (2.0 - 0.5) * 10 * 24 * 7 * 4.33 * 12;
    expect(resultado.economia_anual_kwh).toBeCloseTo(esperadoKwh, 0);
  });

  it("sem valor de investimento, ROI é null (não Infinity nem erro)", () => {
    const resultado = calcularEconomia(inputBase);
    expect(resultado.roi_meses).toBeNull();
  });

  it("com valor de investimento, calcula ROI em meses", () => {
    const resultado = calcularEconomia({ ...inputBase, valor_investimento: 10000 });
    expect(resultado.roi_meses).not.toBeNull();
    expect(resultado.roi_meses).toBeGreaterThan(0);
  });

  it("rejeita horas de operação acima de 24h/dia", () => {
    expect(() => calcularEconomia({ ...inputBase, horas_operacao_dia: 25 })).toThrow();
  });

  it("rejeita dias de operação acima de 7 dias/semana", () => {
    expect(() => calcularEconomia({ ...inputBase, dias_operacao_semana: 8 })).toThrow();
  });
});
