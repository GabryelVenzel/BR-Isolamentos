// lib/orcamento.ts#calcularOrcamento — motor financeiro final do orçamento
// (markup divisor: impostos/margem como % do preço de venda, não do custo).
// Não tinha nenhum teste até agora, apesar de ser o cálculo mais crítico do
// sistema (carga tributária real — ver memória "precificacao-impostos-
// completa"). Escrito ao corrigir o bug relatado: um Item Adicional de
// execução (ex.: "Remoção de isolamento") somava certo no subtotal do
// trecho, mas sumia do Resumo Financeiro final porque `valorMaoObra` sempre
// recomputava do zero como `horas_mao_obra × valor_hora_mao_obra`, ignorando
// qualquer valor de mão de obra que não seja cobrado por hora.
import { calcularOrcamento, OrcamentoConfigError } from "@/lib/orcamento";
import type { CalcularOrcamentoInput, ConfigEmpresa } from "@/lib/types";

function config(overrides: Partial<ConfigEmpresa> = {}): ConfigEmpresa {
  return {
    id: 1,
    nome_empresa: "BR Isolamentos",
    email_empresa: null,
    telefone_empresa: null,
    cnpj: null,
    regime_tributario: "personalizado",
    simples_nacional_anexo: "IV",
    simples_nacional_rbt12: 0,
    margem_lucro_padrao: 20,
    desconto_competitivo: 0,
    valor_hora_mao_obra: 100,
    valor_km_deslocamento: 2,
    valor_noite_hospedagem: 150,
    valor_frete_por_tonelada: 50,
    vedacit_gramas_por_junta: 0,
    isolante_acrescimo_percentual: 0,
    acabamento_acrescimo_percentual: 0,
    rebite_por_m2: 0,
    parafusos_por_m2: 0,
    arame_gramas_por_m2: 0,
    arame_metros_por_m2: 0,
    silicone_intervalo_m2: 0,
    m2_por_hora_dupla: 2,
    eficiencia_tubulacao_pequena: 1,
    eficiencia_tubulacao_media: 1,
    eficiencia_curva: 1,
    eficiencia_altura: 1,
    eficiencia_fator_br: 1,
    horas_uteis_dia: 8,
    valor_diaria_aluguel_carro: 0,
    valor_diaria_alimentacao: 0,
    desconto_avista_percentual: 5,
    garantia_mao_obra_meses: 12,
    projecao_reajuste_tarifario_percentual: 3,
    co2_kg_por_arvore_ano: 22,
    validade_proposta_dias: 30,
    forma_pagamento_padrao: "",
    ...overrides,
  } as ConfigEmpresa;
}

function input(overrides: Partial<CalcularOrcamentoInput> = {}): CalcularOrcamentoInput {
  return {
    valor_materiais_direto: 1000,
    config: config(),
    impostosExtras: [],
    horas_mao_obra: 10,
    km_deslocamento: 0,
    noites_hospedagem: 0,
    toneladas_frete: 0,
    diarias_aluguel_carro: 0,
    quantidade_alimentacao: 0,
    ...overrides,
  };
}

describe("calcularOrcamento — blindagem contra campos numéricos ausentes (bug relatado)", () => {
  it("diarias_aluguel_carro/quantidade_alimentacao ausentes (undefined) não contaminam o cálculo com NaN", () => {
    // Bug relatado: um wizard aberto no navegador ANTES desses campos
    // existirem manda `undefined` pra eles (JSON.stringify descarta chaves
    // undefined) — undefined × preço = NaN, que contaminava a soma inteira
    // (custoTotal, preço cheio, impostos, margem, valor final), e NaN em
    // JSON vira `null`, que a UI exibia como "R$ 0,00" sem erro nenhum.
    const cfg = config({ valor_diaria_aluguel_carro: 100, valor_diaria_alimentacao: 40 });
    const semCamposNovos = { ...input({ config: cfg, valor_materiais_direto: 0, valor_mao_obra_direto: 133, km_deslocamento: 1 }) };
    // Simula o corpo da requisição real depois de passar por JSON.stringify
    // (que descarta chaves com valor `undefined`) — não basta setar
    // `undefined` no objeto TS, precisa passar pelo round-trip de verdade.
    const semCamposNovosViaJson = JSON.parse(
      JSON.stringify({ ...semCamposNovos, diarias_aluguel_carro: undefined, quantidade_alimentacao: undefined })
    );

    const resultado = calcularOrcamento(semCamposNovosViaJson);
    expect(resultado.valor_aluguel_carro).toBe(0);
    expect(resultado.valor_alimentacao).toBe(0);
    expect(resultado.subtotal).toBe(135); // 133 (mão de obra) + 2 (1km × R$2/km, padrão do helper `config()`) — não NaN
    expect(resultado.valor_final).toBeGreaterThan(0);
    expect(Number.isNaN(resultado.valor_final)).toBe(false);
  });

  it("horas_mao_obra/km_deslocamento/noites_hospedagem/toneladas_frete ausentes também caem pra 0, não NaN", () => {
    const entrada = JSON.parse(
      JSON.stringify({
        ...input({ valor_materiais_direto: 500 }),
        horas_mao_obra: undefined,
        km_deslocamento: undefined,
        noites_hospedagem: undefined,
        toneladas_frete: undefined,
        diarias_aluguel_carro: undefined,
        quantidade_alimentacao: undefined,
      })
    );
    const resultado = calcularOrcamento(entrada);
    expect(resultado.subtotal).toBe(500);
    expect(Number.isNaN(resultado.valor_final)).toBe(false);
  });
});

describe("calcularOrcamento — markup divisor", () => {
  it("custo total = materiais + mão de obra (horas × valor/hora) + deslocamento + hospedagem + frete", () => {
    const resultado = calcularOrcamento(
      input({ valor_materiais_direto: 1000, horas_mao_obra: 10, km_deslocamento: 100, noites_hospedagem: 1, toneladas_frete: 0 })
    );
    // mão de obra = 10h × R$100 = R$1000; deslocamento = 100km × R$2 = R$200; hospedagem = 1 × R$150
    expect(resultado.valor_mao_obra).toBe(1000);
    expect(resultado.valor_deslocamento).toBe(200);
    expect(resultado.valor_hospedagem).toBe(150);
    expect(resultado.subtotal).toBe(1000 + 1000 + 200 + 150);
  });

  it("preço de venda: margem/impostos incidem sobre o PREÇO CHEIO, não sobre o custo (markup divisor)", () => {
    // custo total = 1000 (só materiais); margem 20%, sem impostos extras
    const resultado = calcularOrcamento(input({ valor_materiais_direto: 1000, horas_mao_obra: 0 }));
    // precoCheio = custoTotal / (1 - 20/100) = 1000 / 0,8 = 1250
    expect(resultado.preco_cheio).toBe(1250);
    expect(resultado.margem_lucro).toBe(250); // 20% de 1250, não 20% de 1000
    expect(resultado.valor_final).toBe(1250);
  });

  it("aluguel de carro e alimentação entram no custo total (migração 032), diárias × preço configurado", () => {
    const cfg = config({ valor_diaria_aluguel_carro: 120, valor_diaria_alimentacao: 40 });
    const resultado = calcularOrcamento(
      input({ config: cfg, valor_materiais_direto: 0, horas_mao_obra: 0, diarias_aluguel_carro: 3, quantidade_alimentacao: 5 })
    );
    expect(resultado.valor_aluguel_carro).toBe(360); // 3 × R$120
    expect(resultado.valor_alimentacao).toBe(200); // 5 × R$40
    expect(resultado.subtotal).toBe(560);
  });

  it("bloqueia com OrcamentoConfigError quando impostos + margem somam 100% ou mais", () => {
    const cfg = config({ margem_lucro_padrao: 60 });
    expect(() =>
      calcularOrcamento(input({ config: cfg, impostosExtras: [{ id: 1, nome: "ISS", percentual: 40, ativo: true, ordem: 1 }] }))
    ).toThrow(OrcamentoConfigError);
  });
});

describe("calcularOrcamento — desconto (bug relatado: imposto/margem ignoravam o desconto)", () => {
  it("regressão: caso real relatado (sem desconto) continua batendo exatamente", () => {
    // Custo total R$872,16 (materiais R$773,16 + execução R$99,00), Simples
    // Nacional 8,08%, margem 30% — os mesmos números do print do usuário.
    const cfg = config({ margem_lucro_padrao: 30 });
    const resultado = calcularOrcamento(
      input({
        config: cfg,
        impostosExtras: [{ id: 1, nome: "Simples Nacional (DAS, Anexo III)", percentual: 8.08, ativo: true, ordem: 1 }],
        valor_materiais_direto: 773.16,
        valor_mao_obra_direto: 99,
        horas_mao_obra: 0,
      })
    );
    expect(resultado.subtotal).toBe(872.16);
    expect(resultado.total_impostos).toBe(113.81);
    expect(resultado.margem_lucro).toBe(422.56);
    expect(resultado.valor_final).toBe(1408.53);
  });

  it("com desconto, o imposto incide sobre o valor JÁ COM DESCONTO (o que de fato vai na nota), não sobre o preço cheio", () => {
    const cfg = config({ margem_lucro_padrao: 30 });
    const semDesconto = calcularOrcamento(
      input({
        config: cfg,
        impostosExtras: [{ id: 1, nome: "Simples Nacional", percentual: 8.08, ativo: true, ordem: 1 }],
        valor_materiais_direto: 773.16,
        valor_mao_obra_direto: 99,
        horas_mao_obra: 0,
      })
    );
    const comDesconto = calcularOrcamento(
      input({
        config: cfg,
        impostosExtras: [{ id: 1, nome: "Simples Nacional", percentual: 8.08, ativo: true, ordem: 1 }],
        valor_materiais_direto: 773.16,
        valor_mao_obra_direto: 99,
        horas_mao_obra: 0,
        desconto_percentual_extra: 10,
      })
    );
    // preço cheio não muda (desconto é aplicado DEPOIS dele) — R$1.408,53.
    expect(comDesconto.preco_cheio).toBe(semDesconto.preco_cheio);
    // valor final = preço cheio - 10% = R$1.267,68 (o que de fato vai na nota).
    expect(comDesconto.valor_final).toBe(1267.68);
    // Imposto = 8,08% do valor final COM desconto (R$102,43), não do preço
    // cheio sem desconto (que daria R$113,81, igual o caso acima).
    expect(comDesconto.total_impostos).toBe(102.43);
    expect(comDesconto.total_impostos).toBeLessThan(semDesconto.total_impostos);
    // Custo (material + mão de obra) não muda com desconto — quem absorve a
    // diferença inteira é a margem, não o imposto nem o custo.
    expect(comDesconto.valor_materiais + comDesconto.valor_mao_obra).toBe(872.16);
    // Margem = valor final - custo - imposto = 1267,68 - 872,16 - 102,43.
    expect(comDesconto.margem_lucro).toBe(293.09);
    expect(comDesconto.margem_lucro).toBeLessThan(semDesconto.margem_lucro);
    // O percentual de margem EXIBIDO reflete o que foi de fato alcançado
    // (menor que os 30% configurados, porque o desconto saiu do lucro).
    expect(comDesconto.percentual_margem).toBeLessThan(30);
  });

  it("sem desconto, o percentual de margem efetivo bate com o configurado (nenhuma mudança de comportamento)", () => {
    const resultado = calcularOrcamento(input({ valor_materiais_direto: 1000, horas_mao_obra: 0 }));
    expect(resultado.percentual_margem).toBe(20); // config padrão: margem_lucro_padrao = 20
  });
});

describe("calcularOrcamento — valor_mao_obra_direto (bug: item adicional de execução sumia do total)", () => {
  it("sem valor_mao_obra_direto, usa horas × valor/hora (comportamento antigo)", () => {
    const resultado = calcularOrcamento(input({ horas_mao_obra: 5 })); // 5h × R$100
    expect(resultado.valor_mao_obra).toBe(500);
  });

  it("com valor_mao_obra_direto, usa o valor direto — mesmo que horas_mao_obra também esteja preenchido", () => {
    // Cenário do bug: horas_mao_obra (5h × R$100 = R$500) é só a mão de obra
    // automática; o subtotal_mao_obra real do trecho é R$800 porque inclui
    // um Item Adicional de execução ("Remoção de isolamento", R$300) que não
    // é cobrado por hora — valor_mao_obra_direto precisa vencer o cálculo
    // por horas, não ser somado a ele.
    const resultado = calcularOrcamento(input({ horas_mao_obra: 5, valor_mao_obra_direto: 800 }));
    expect(resultado.valor_mao_obra).toBe(800);
  });

  it("valor_mao_obra_direto = 0 é respeitado (não cai no fallback de horas)", () => {
    const resultado = calcularOrcamento(input({ horas_mao_obra: 5, valor_mao_obra_direto: 0 }));
    expect(resultado.valor_mao_obra).toBe(0);
  });
});
