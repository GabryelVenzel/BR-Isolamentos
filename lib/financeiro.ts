// Regras PURAS do financeiro (migração 041) compartilhadas entre telas, rotas
// e casos de uso: formas de pagamento, situação de um lançamento, geração de
// parcelas/recorrências e totais de uma lista. Sem Supabase e sem React.

import type { FormaPagamento, LancamentoFinanceiro, TipoLancamentoFinanceiro } from "./types/domain";

export const FORMAS_PAGAMENTO: FormaPagamento[] = ["pix", "boleto", "transferencia", "cartao", "dinheiro", "outro"];

export const LABEL_FORMA_PAGAMENTO: Record<FormaPagamento, string> = {
  pix: "PIX",
  boleto: "Boleto",
  transferencia: "Transferência",
  cartao: "Cartão",
  dinheiro: "Dinheiro",
  outro: "Outro",
};

export const MAXIMO_PARCELAS = 60;

/** "Hoje" no fuso de Brasília, como YYYY-MM-DD (o servidor roda em UTC). */
export function hojeBrasilia(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(agora);
}

/** Soma meses a uma data YYYY-MM-DD mantendo o dia; se o mês de destino não
 * tem aquele dia (31 → fevereiro), usa o último dia do mês. */
export function somarMeses(dataISO: string, meses: number): string {
  const [ano, mes, dia] = dataISO.slice(0, 10).split("-").map(Number);
  const alvo = new Date(Date.UTC(ano, mes - 1 + meses, 1));
  const ultimoDia = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  const y = alvo.getUTCFullYear();
  const m = String(alvo.getUTCMonth() + 1).padStart(2, "0");
  const d = String(Math.min(dia, ultimoDia)).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// --- Situação ---------------------------------------------------------------

export type SituacaoLancamento = "pago" | "vencido" | "vence_hoje" | "a_vencer";

export function situacaoLancamento(lancamento: Pick<LancamentoFinanceiro, "pago" | "data">, hoje: string = hojeBrasilia()): SituacaoLancamento {
  if (lancamento.pago) return "pago";
  const vencimento = lancamento.data.slice(0, 10);
  if (vencimento < hoje) return "vencido";
  if (vencimento === hoje) return "vence_hoje";
  return "a_vencer";
}

export function labelSituacao(situacao: SituacaoLancamento, tipo: TipoLancamentoFinanceiro): string {
  if (situacao === "pago") return tipo === "receita" ? "Recebido" : "Pago";
  if (situacao === "vencido") return "Vencido";
  if (situacao === "vence_hoje") return "Vence hoje";
  return "A vencer";
}

// --- Parcelas e recorrência ------------------------------------------------

export interface DadosParcelamento {
  descricao: string;
  valor: number;
  /** Vencimento do primeiro lançamento (YYYY-MM-DD). */
  data: string;
  /** Competência do primeiro lançamento (YYYY-MM-DD). */
  data_competencia: string;
}

export interface ParcelaGerada {
  descricao: string;
  valor: number;
  data: string;
  data_competencia: string;
  parcela_numero: number;
  parcela_total: number;
}

/** "Parcelado em N": o VALOR TOTAL é dividido em N lançamentos com
 * vencimentos mensais. A competência é a mesma em todas (a compra/venda
 * aconteceu de uma vez; só o pagamento é que se espalha). Os centavos que
 * sobram da divisão vão para a última parcela, pra soma fechar exata. */
export function gerarParcelas(dados: DadosParcelamento, quantidade: number): ParcelaGerada[] {
  const totalCentavos = Math.round(dados.valor * 100);
  const base = Math.floor(totalCentavos / quantidade);
  return Array.from({ length: quantidade }, (_, i) => ({
    descricao: `${dados.descricao} (${i + 1}/${quantidade})`,
    valor: (i === quantidade - 1 ? totalCentavos - base * (quantidade - 1) : base) / 100,
    data: somarMeses(dados.data, i),
    data_competencia: dados.data_competencia,
    parcela_numero: i + 1,
    parcela_total: quantidade,
  }));
}

/** "Repetir por N meses": N lançamentos com o VALOR CHEIO cada, um por mês —
 * vencimento e competência andam juntos (cada mês é um fato novo). */
export function gerarRecorrencia(dados: DadosParcelamento, meses: number): ParcelaGerada[] {
  return Array.from({ length: meses }, (_, i) => ({
    descricao: `${dados.descricao} (${i + 1}/${meses})`,
    valor: dados.valor,
    data: somarMeses(dados.data, i),
    data_competencia: somarMeses(dados.data_competencia, i),
    parcela_numero: i + 1,
    parcela_total: meses,
  }));
}

// --- Totais de uma lista ---------------------------------------------------

export interface TotaisLancamentos {
  aReceber: number;
  aPagar: number;
  /** Em aberto com vencimento anterior a hoje (receber e pagar separados). */
  vencidoAReceber: number;
  vencidoAPagar: number;
  recebido: number;
  pago: number;
  /** Receitas − despesas da lista inteira (pagas ou não). */
  saldoPrevisto: number;
}

export function totaisLancamentos(
  lancamentos: Array<Pick<LancamentoFinanceiro, "tipo" | "valor" | "pago" | "data">>,
  hoje: string = hojeBrasilia()
): TotaisLancamentos {
  const t: TotaisLancamentos = { aReceber: 0, aPagar: 0, vencidoAReceber: 0, vencidoAPagar: 0, recebido: 0, pago: 0, saldoPrevisto: 0 };
  for (const l of lancamentos) {
    const receita = l.tipo === "receita";
    t.saldoPrevisto += receita ? l.valor : -l.valor;
    if (l.pago) {
      if (receita) t.recebido += l.valor;
      else t.pago += l.valor;
      continue;
    }
    if (receita) t.aReceber += l.valor;
    else t.aPagar += l.valor;
    if (situacaoLancamento(l, hoje) === "vencido") {
      if (receita) t.vencidoAReceber += l.valor;
      else t.vencidoAPagar += l.valor;
    }
  }
  return t;
}
