// Encargos sobre a mão de obra (migração 056) — puro, sem I/O.
//
// Especificação: "0.Arquivos BR Isolamentos/07 - Sistema/Direcionamento_
// Encargos_Mao_de_Obra_Orcamento.docx" (17/10/2026). Resumo:
//
//   - A diária configurada é o VALOR COMBINADO (o que a pessoa recebe).
//   - MEI e PJ: o valor combinado é o valor da nota — custo = combinado.
//   - MEI com INSS patronal (LC 123/2006, art. 18-B: hidráulica, eletricidade,
//     pintura, alvenaria, carpintaria): custo = combinado + 20% (CPP).
//   - Pessoa física (autônomo, RPA): o combinado é o LÍQUIDO. A BR paga um
//     BRUTO maior, do qual desconta e recolhe o INSS (11%, até o teto) e o IR
//     (tabela mensal, com a redução da Lei 15.270/2025) e, se o município
//     exigir, o ISS. No Anexo IV do Simples (e fora do Simples) a BR ainda
//     paga 20% de INSS patronal sobre o bruto; no Anexo III ele já está no DAS.
//   - INSS e IR são MENSAIS por pessoa: as diárias são divididas em blocos de
//     até `dias_trabalho_mes` (padrão 22) e cada bloco é um mês.
//
// O custo real entra no custo do orçamento; o DAS e a margem continuam sendo
// aplicados por cima, sobre o valor final (calcularOrcamento não muda).

import type { ConfigEmpresa } from "../../types";

export type FormaContratacao = "mei" | "pf" | "pj" | "mei_cpp" | "nao_informada";

export const FORMAS_CONTRATACAO: readonly Exclude<FormaContratacao, "nao_informada">[] = ["mei", "pf", "pj", "mei_cpp"];

export const LABEL_FORMA_CONTRATACAO: Record<FormaContratacao, string> = {
  mei: "MEI",
  pf: "Pessoa física (RPA)",
  pj: "PJ (empresa)",
  mei_cpp: "MEI com INSS patronal",
  nao_informada: "Não informada (orçamento antigo)",
};

export interface FaixaIrrf {
  /** Limite superior da faixa (base de cálculo); `null` = sem limite. */
  ate: number | null;
  aliquota: number;
  deducao: number;
}

export interface ReducaoIrrf {
  ativa: boolean;
  /** Rendimento até este valor: IR zerado. */
  isencao_ate: number;
  /** Até este valor: redução = constante − coeficiente × rendimento. */
  reducao_ate: number;
  constante: number;
  coeficiente: number;
}

export interface ParametrosEncargos {
  inss_pf_pct: number;
  teto_inss: number;
  cpp_pct: number;
  tabela_irrf: FaixaIrrf[];
  irrf_desconto_simplificado: number;
  reducao_irrf: ReducaoIrrf;
  iss_autonomo_pct: number;
  dias_trabalho_mes: number;
  /** A BR paga os 20% patronais sobre a pessoa física? Não no Simples Anexo
   * III (já está no DAS); sim no Anexo IV e fora do Simples. */
  cpp_sobre_pf: boolean;
}

/** Valores de 2026 (documento de direcionamento, item 6.1). */
export const TABELA_IRRF_2026: FaixaIrrf[] = [
  { ate: 2428.8, aliquota: 0, deducao: 0 },
  { ate: 2826.65, aliquota: 7.5, deducao: 182.16 },
  { ate: 3751.05, aliquota: 15, deducao: 394.16 },
  { ate: 4664.68, aliquota: 22.5, deducao: 675.49 },
  { ate: null, aliquota: 27.5, deducao: 908.73 },
];

export const REDUCAO_IRRF_2026: ReducaoIrrf = { ativa: true, isencao_ate: 5000, reducao_ate: 7350, constante: 978.62, coeficiente: 0.133145 };

export const PARAMETROS_ENCARGOS_2026: Omit<ParametrosEncargos, "cpp_sobre_pf"> = {
  inss_pf_pct: 11,
  teto_inss: 8475.55,
  cpp_pct: 20,
  tabela_irrf: TABELA_IRRF_2026,
  irrf_desconto_simplificado: 607.2,
  reducao_irrf: REDUCAO_IRRF_2026,
  iss_autonomo_pct: 0,
  dias_trabalho_mes: 22,
};

const num = (v: unknown, padrao: number) => {
  const n = Number(v);
  return v === null || v === undefined || v === "" || !Number.isFinite(n) ? padrao : n;
};
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Parâmetros a partir da configuração (colunas da migração 056); o que
 * faltar usa os valores de 2026. */
export function parametrosEncargosDaConfig(
  config: Partial<
    Pick<
      ConfigEmpresa,
      | "regime_tributario"
      | "simples_nacional_anexo"
      | "encargos_inss_pf_pct"
      | "encargos_teto_inss"
      | "encargos_cpp_pct"
      | "encargos_tabela_irrf"
      | "encargos_irrf_desconto_simplificado"
      | "encargos_reducao_irrf"
      | "encargos_iss_autonomo_pct"
      | "encargos_dias_trabalho_mes"
    >
  >
): ParametrosEncargos {
  const p = PARAMETROS_ENCARGOS_2026;
  const tabela = Array.isArray(config.encargos_tabela_irrf) && config.encargos_tabela_irrf.length > 0 ? (config.encargos_tabela_irrf as FaixaIrrf[]) : p.tabela_irrf;
  const reducao = config.encargos_reducao_irrf && typeof config.encargos_reducao_irrf === "object" ? { ...p.reducao_irrf, ...(config.encargos_reducao_irrf as Partial<ReducaoIrrf>) } : p.reducao_irrf;
  const simplesAnexoIII = (config.regime_tributario ?? "simples_nacional") === "simples_nacional" && (config.simples_nacional_anexo ?? "IV") === "III";
  return {
    inss_pf_pct: num(config.encargos_inss_pf_pct, p.inss_pf_pct),
    teto_inss: num(config.encargos_teto_inss, p.teto_inss),
    cpp_pct: num(config.encargos_cpp_pct, p.cpp_pct),
    tabela_irrf: tabela,
    irrf_desconto_simplificado: num(config.encargos_irrf_desconto_simplificado, p.irrf_desconto_simplificado),
    reducao_irrf: reducao,
    iss_autonomo_pct: num(config.encargos_iss_autonomo_pct, p.iss_autonomo_pct),
    dias_trabalho_mes: Math.max(1, Math.floor(num(config.encargos_dias_trabalho_mes, p.dias_trabalho_mes))),
    cpp_sobre_pf: !simplesAnexoIII,
  };
}

/** IR da tabela sobre uma base de cálculo. */
function irDaTabela(base: number, tabela: FaixaIrrf[]): number {
  if (base <= 0) return 0;
  const faixa = tabela.find((f) => f.ate === null || base <= f.ate) ?? tabela[tabela.length - 1];
  return Math.max(0, (base * faixa.aliquota) / 100 - faixa.deducao);
}

export interface RetencoesMes {
  bruto: number;
  inss: number;
  irrf: number;
  iss: number;
  liquido: number;
}

/** Retenções de UM mês sobre um bruto B (item 4.2 do documento). */
export function retencoesDoBruto(bruto: number, p: ParametrosEncargos): RetencoesMes {
  const inss = Math.min((bruto * p.inss_pf_pct) / 100, (p.teto_inss * p.inss_pf_pct) / 100);
  // Dependentes: o orçamento considera 0.
  const deducao = Math.max(inss, p.irrf_desconto_simplificado);
  let irrf = irDaTabela(bruto - deducao, p.tabela_irrf);
  // Lei 15.270/2025 — redução sobre o IR da tabela, pelo rendimento bruto do mês.
  if (p.reducao_irrf.ativa && irrf > 0) {
    if (bruto <= p.reducao_irrf.isencao_ate) irrf = 0;
    else if (bruto <= p.reducao_irrf.reducao_ate) irrf = Math.max(0, irrf - (p.reducao_irrf.constante - p.reducao_irrf.coeficiente * bruto));
  }
  const iss = (bruto * p.iss_autonomo_pct) / 100;
  // Cada retenção é recolhida em centavos — o líquido é o bruto menos os
  // valores já arredondados (mesma convenção do documento e da guia).
  const r = { inss: round2(inss), irrf: round2(irrf), iss: round2(iss) };
  return { bruto, ...r, liquido: round2(bruto - r.inss - r.irrf - r.iss) };
}

/** Bruto que deixa `liquido` na mão da pessoa (gross-up por bisseção — o IR
 * tem faixas, teto e redução, sem fórmula fechada). Arredonda para cima: a
 * BR nunca paga menos que o combinado. */
export function brutoParaLiquido(liquido: number, p: ParametrosEncargos): number {
  if (!(liquido > 0)) return 0;
  let lo = liquido;
  let hi = liquido * 3;
  for (let i = 0; i < 80; i++) {
    const meio = (lo + hi) / 2;
    if (retencoesDoBruto(meio, p).liquido < liquido) lo = meio;
    else hi = meio;
  }
  const alvo = round2(liquido);
  let bruto = Math.ceil(hi * 100 - 1e-6) / 100;
  // Em centavos: o MENOR bruto cujo líquido não fica abaixo do combinado.
  while (retencoesDoBruto(bruto, p).liquido < alvo) bruto = round2(bruto + 0.01);
  while (bruto > 0.01 && retencoesDoBruto(round2(bruto - 0.01), p).liquido >= alvo) bruto = round2(bruto - 0.01);
  return bruto;
}

export interface EncargosPessoa {
  /** Soma do que a pessoa recebe (diárias × valor combinado). */
  valor_pago: number;
  bruto: number;
  inss: number;
  irrf: number;
  iss: number;
  /** INSS patronal pago pela BR. */
  cpp: number;
  /** O que a pessoa custa para a BR (bruto + CPP). */
  custo_real: number;
}

/** Custo de UMA pessoa por `diarias` dias, pela forma de contratação. */
export function encargosDaPessoa(forma: FormaContratacao, valorDiaria: number, diarias: number, p: ParametrosEncargos): EncargosPessoa {
  const dias = Math.max(0, Math.floor(diarias));
  const valorPago = round2(dias * Math.max(0, valorDiaria));
  const zero = { valor_pago: valorPago, bruto: valorPago, inss: 0, irrf: 0, iss: 0, cpp: 0, custo_real: valorPago };
  if (forma === "mei_cpp") {
    const cpp = round2((valorPago * p.cpp_pct) / 100);
    return { ...zero, cpp, custo_real: round2(valorPago + cpp) };
  }
  if (forma !== "pf" || valorPago === 0) return zero;

  // Pessoa física: um bloco por mês de até dias_trabalho_mes diárias.
  let restante = dias;
  const total = { bruto: 0, inss: 0, irrf: 0, iss: 0, cpp: 0 };
  while (restante > 0) {
    const n = Math.min(restante, p.dias_trabalho_mes);
    restante -= n;
    const bruto = brutoParaLiquido(n * valorDiaria, p);
    const r = retencoesDoBruto(bruto, p);
    total.bruto += bruto;
    total.inss += round2(r.inss);
    total.irrf += round2(r.irrf);
    total.iss += round2(r.iss);
    total.cpp += p.cpp_sobre_pf ? round2((bruto * p.cpp_pct) / 100) : 0;
  }
  const bruto = round2(total.bruto);
  const cpp = round2(total.cpp);
  return { valor_pago: valorPago, bruto, inss: round2(total.inss), irrf: round2(total.irrf), iss: round2(total.iss), cpp, custo_real: round2(bruto + cpp) };
}
