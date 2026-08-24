import type { LancamentoFinanceiro } from "../../types/domain";

// Cálculos financeiros — funções puras (sem I/O), mesmo espírito de
// lib/usecases/comercial/relatorio.ts e lib/usecases/operacional/relatorio.ts.
//
// "Fluxo de caixa projetado dia-a-dia" do pedido original NÃO foi
// implementado aqui de propósito — o dashboard Resumo já tem exatamente essa
// projeção (GET /api/resumo/charts/cashflow-projecao,
// components/modules/resumo/CashFlowChart.tsx); duplicar o motor de projeção
// aqui seria manter duas implementações da mesma conta. "Saúde financeira
// (scorecard)" também não foi implementado — o pedido não definiu quais
// critérios comporiam esse score.

export interface KpisFinanceiro {
  receitaTotal: number;
  despesaTotal: number;
  custosFixosMensal: number;
  lucroLiquido: number;
  margemPercentual: number | null;
}

/** `custosFixosMensal` vem de fora (soma de `custos_fixos` ativos — não dá
 * pra derivar da lista de lançamentos, que registra o que JÁ foi pago, não
 * a obrigação mensal recorrente). */
export function calcularKpisFinanceiro(lancamentos: LancamentoFinanceiro[], custosFixosMensal: number): KpisFinanceiro {
  const receitaTotal = lancamentos.filter((l) => l.tipo === "receita").reduce((soma, l) => soma + l.valor, 0);
  const despesaTotal = lancamentos.filter((l) => l.tipo === "despesa").reduce((soma, l) => soma + l.valor, 0);
  const lucroLiquido = receitaTotal - despesaTotal;

  return {
    receitaTotal,
    despesaTotal,
    custosFixosMensal,
    lucroLiquido,
    margemPercentual: receitaTotal > 0 ? (lucroLiquido / receitaTotal) * 100 : null,
  };
}

export interface DistribuicaoCategoria {
  categoria: string;
  valor: number;
  percentual: number;
}

export function calcularDistribuicaoPorCategoria(lancamentos: LancamentoFinanceiro[], tipo: "receita" | "despesa"): DistribuicaoCategoria[] {
  const filtrados = lancamentos.filter((l) => l.tipo === tipo);
  const total = filtrados.reduce((soma, l) => soma + l.valor, 0);

  const porCategoria = new Map<string, number>();
  for (const l of filtrados) {
    porCategoria.set(l.categoria, (porCategoria.get(l.categoria) ?? 0) + l.valor);
  }

  return Array.from(porCategoria.entries())
    .map(([categoria, valor]) => ({ categoria, valor, percentual: total > 0 ? (valor / total) * 100 : 0 }))
    .sort((a, b) => b.valor - a.valor);
}

export interface CustosFixosVsVariaveis {
  fixos: number;
  variaveis: number;
  totalDespesa: number;
}

/** "Fixos" aqui é o que foi de fato REGISTRADO no período com a categoria
 * "Custo fixo" (não a obrigação mensal recorrente — para isso, ver
 * `custosFixosMensal` em `calcularKpisFinanceiro`). "Variáveis" é o resto
 * das despesas do período. */
export function calcularCustosFixosVsVariaveis(lancamentos: LancamentoFinanceiro[]): CustosFixosVsVariaveis {
  const despesas = lancamentos.filter((l) => l.tipo === "despesa");
  const fixos = despesas.filter((l) => l.categoria === "Custo fixo").reduce((soma, l) => soma + l.valor, 0);
  const totalDespesa = despesas.reduce((soma, l) => soma + l.valor, 0);

  return { fixos, variaveis: Math.max(0, totalDespesa - fixos), totalDespesa };
}

export interface ReceitaDespesaMes {
  mes: string; // YYYY-MM
  receita: number;
  despesa: number;
  lucro: number;
}

/** Agrupa lançamentos por mês (YYYY-MM da coluna `data`) — mesma técnica de
 * lib/usecases/resumo/receitaVsDespesa.ts (agrupar em memória, não dá pra
 * expressar "por mês arbitrário" só com o query builder). */
export function calcularReceitaVsDespesaPorMes(lancamentos: LancamentoFinanceiro[]): ReceitaDespesaMes[] {
  const porMes = new Map<string, { receita: number; despesa: number }>();

  for (const l of lancamentos) {
    const mes = l.data.slice(0, 7);
    const atual = porMes.get(mes) ?? { receita: 0, despesa: 0 };
    if (l.tipo === "receita") atual.receita += l.valor;
    else atual.despesa += l.valor;
    porMes.set(mes, atual);
  }

  return Array.from(porMes.entries())
    .map(([mes, v]) => ({ mes, ...v, lucro: v.receita - v.despesa }))
    .sort((a, b) => a.mes.localeCompare(b.mes));
}

export interface AlertaFinanceiro {
  tipo: "receita_pendente" | "despesa_pendente" | "custo_fixo_atrasado";
  mensagem: string;
  valor: number;
}

export function calcularAlertas(lancamentosPendentes: LancamentoFinanceiro[]): AlertaFinanceiro[] {
  const alertas: AlertaFinanceiro[] = [];

  const receitasPendentes = lancamentosPendentes.filter((l) => l.tipo === "receita" && !l.pago);
  const valorReceitasPendentes = receitasPendentes.reduce((soma, l) => soma + l.valor, 0);
  if (valorReceitasPendentes > 0) {
    alertas.push({ tipo: "receita_pendente", mensagem: `${receitasPendentes.length} receita(s) não recebida(s)`, valor: valorReceitasPendentes });
  }

  const despesasPendentes = lancamentosPendentes.filter((l) => l.tipo === "despesa" && !l.pago);
  const valorDespesasPendentes = despesasPendentes.reduce((soma, l) => soma + l.valor, 0);
  if (valorDespesasPendentes > 0) {
    alertas.push({ tipo: "despesa_pendente", mensagem: `${despesasPendentes.length} despesa(s) não paga(s)`, valor: valorDespesasPendentes });
  }

  return alertas;
}
