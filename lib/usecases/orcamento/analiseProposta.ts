// Cálculos de apoio às Propostas Técnica/Comercial (payback, projeção de
// economia, equivalência ambiental, prazo de execução) — puros, sem I/O,
// compartilhados entre o gerador de PDF (components/pdf-native/*) e o de
// Word (lib/docx-generator.ts) para as duas versões nunca divergirem.
//
// Nenhum número de política comercial (reajuste tarifário assumido, fator de
// CO₂ por árvore) é fixo aqui — sempre recebido como parâmetro
// (ConfigEmpresa), ver decisão 2 em sql-migration-020-detalhamento-propostas.sql.

import type { ItemOrcamento, Orcamento } from "../../types";

export interface BeneficiosConsolidados {
  economiaAnualTotal: number;
  co2ToneladasAno: number;
}

/** Soma a economia anual e o CO₂ evitado de todos os trechos com resultado
 * financeiro (só trechos "quente" com `calcular_financeiro` preenchem esses
 * campos — ver lib/calculadora-termica.ts). */
export function calcularBeneficiosConsolidados(itens: ItemOrcamento[]): BeneficiosConsolidados {
  return {
    economiaAnualTotal: Number(itens.reduce((acc, i) => acc + (i.economia_anual ?? 0), 0).toFixed(2)),
    co2ToneladasAno: Number(itens.reduce((acc, i) => acc + (i.co2_ton_ano ?? 0), 0).toFixed(3)),
  };
}

/** Payback em meses para proposta "Material + Mão de Obra": tempo para a
 * economia anual pagar o valor total investido. `null` quando não há
 * economia estimada (ex.: orçamento só de trechos frios, ou sem cálculo
 * financeiro habilitado) — nesse caso a proposta não deve exibir a caixa de
 * payback, exibir "0" ou "Infinity" seria enganoso. */
export function calcularPaybackMeses(valorFinal: number, economiaAnualTotal: number): number | null {
  if (economiaAnualTotal <= 0) return null;
  return Number(((valorFinal / economiaAnualTotal) * 12).toFixed(1));
}

/** Payback em dias para proposta "Somente Mão de Obra" — o material já foi
 * fornecido pelo cliente, então o "investimento" relevante pro payback é só
 * o valor da mão de obra (`valorFinal`, que em somente_mo já reflete isso —
 * ver lib/orcamento.ts). Tende a ser bem mais rápido, por isso em dias em
 * vez de meses (ver Parte 2 do pedido "COMPLEMENTO: PROPOSTAS DIFERENCIADAS"). */
export function calcularPaybackDias(valorFinal: number, economiaAnualTotal: number): number | null {
  if (economiaAnualTotal <= 0) return null;
  return Math.round((valorFinal / economiaAnualTotal) * 365);
}

export interface LinhaProjecao {
  ano: number;
  economiaDoAno: number;
  acumulado: number;
}

/** Projeção de economia acumulada por `anos` anos (padrão 10), aplicando o
 * reajuste tarifário anual configurado (`reajustePercentual`, ver
 * ConfigEmpresa.projecao_reajuste_tarifario_percentual) sobre a economia
 * anual base. Com reajuste 0, a economia do ano é constante — a projeção
 * continua útil (mostra só o acumulado simples), sem assumir nenhum reajuste
 * que a empresa não tenha configurado. É uma ESTIMATIVA de mercado, não uma
 * garantia contratual (ver rodapé da Proposta Comercial). */
export function projetarEconomiaAcumulada(economiaAnualBase: number, reajustePercentual: number, anos = 10): LinhaProjecao[] {
  const linhas: LinhaProjecao[] = [];
  let acumulado = 0;
  for (let ano = 1; ano <= anos; ano++) {
    const economiaDoAno = Number((economiaAnualBase * Math.pow(1 + reajustePercentual / 100, ano - 1)).toFixed(2));
    acumulado = Number((acumulado + economiaDoAno).toFixed(2));
    linhas.push({ ano, economiaDoAno, acumulado });
  }
  return linhas;
}

/** Equivalência ilustrativa "toneladas de CO₂ evitadas" → "árvores
 * plantadas", usando o fator configurável (kg de CO₂ absorvido por uma
 * árvore adulta por ano). Estimativa de comunicação ambiental, não uma
 * métrica de compensação de carbono certificada — ver ConfigEmpresa.
 * co2_kg_por_arvore_ano. */
export function arvoresEquivalentes(co2ToneladasAno: number, kgPorArvoreAno: number): number {
  if (kgPorArvoreAno <= 0) return 0;
  return Math.round((co2ToneladasAno * 1000) / kgPorArvoreAno);
}

/** Prazo de execução estimado (dias úteis), a partir da mão de obra já
 * calculada por trecho (`horas_mao_obra`, automática desde a migração 019) —
 * não é um campo novo, só a soma de um dado que já existe dividida pela
 * jornada configurada. Arredondado para cima (dia parcial conta como dia
 * inteiro de obra). */
export function prazoExecucaoDiasUteis(itens: ItemOrcamento[], horasUteisDia: number): number {
  if (horasUteisDia <= 0) return 0;
  const horasTotais = itens.reduce((acc, i) => acc + (i.horas_mao_obra ?? 0), 0);
  return Math.max(1, Math.ceil(horasTotais / horasUteisDia));
}

/** true quando o orçamento tem dado suficiente para exibir a seção de
 * payback/projeção (precisa de valor final > 0 e alguma economia estimada). */
export function temAnaliseFinanceira(orcamento: Pick<Orcamento, "valor_final">, economiaAnualTotal: number): boolean {
  return orcamento.valor_final > 0 && economiaAnualTotal > 0;
}

/** Descrição completa de um material — nome + especificação (densidade) +
 * espessura calculada num único texto (ex.: "Fibra Cerâmica 96kg/m³ 51mm"),
 * usada nas tabelas da Proposta Técnica em vez de colunas separadas. Omite a
 * espessura quando zero/ausente (trechos sem cálculo térmico, ex.: material
 * customizado). */
export function descricaoMaterialCompleta(
  item: Pick<ItemOrcamento, "material" | "especificacao_isolante" | "espessura_necessaria_mm">
): string {
  const partes = [item.material, item.especificacao_isolante].filter(Boolean) as string[];
  if (item.espessura_necessaria_mm > 0) partes.push(`${item.espessura_necessaria_mm}mm`);
  return partes.join(" ");
}

/** O que o orçamento contempla, conforme `tipo_proposta` — usada tanto na
 * Proposta Técnica (seção "Escopo contemplado") quanto na Comercial
 * (Condições Comerciais), pra nunca divergir entre as duas. */
export function itensContemplados(tipoProposta: "material_mo" | "somente_mo"): string[] {
  const itens = ["Mão de obra especializada", "Equipamentos de proteção individual (EPI) da equipe", "Coordenação técnica da execução"];
  if (tipoProposta === "material_mo") itens.push("Material isolante completo", "Acabamentos (chaparia)");
  return itens;
}

/** O que o orçamento NÃO contempla — ver `itensContemplados`. */
export function itensNaoContemplados(tipoProposta: "material_mo" | "somente_mo"): string[] {
  const itens: string[] = [];
  if (tipoProposta === "somente_mo") itens.push("Material isolante e acabamentos (fornecidos pelo cliente)");
  itens.push(
    "Estruturas de acesso para trabalho em altura (andaimes/plataformas), salvo se explicitamente incluídas",
    "Adequações civis/estruturais e remoção de isolamento antigo, salvo se explicitamente incluídas"
  );
  return itens;
}
