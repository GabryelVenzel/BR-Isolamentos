// Cálculos puros sobre custo fixo — "próximo pagamento" e o mês/ano previsto
// pro histórico do mês atual (ver garantirHistoricoMesAtual.ts). Sem I/O,
// fáceis de testar sem mockar Supabase.

/** Último dia válido do mês de `ano`/`mes` (1-indexado) — usado pra não
 * estourar fevereiro quando `diaMes` é 30/31. */
function ultimoDiaDoMes(ano: number, mes: number): number {
  return new Date(ano, mes, 0).getDate();
}

/** Data (YYYY-MM-DD) do próximo pagamento de um custo com vencimento no dia
 * `diaMes` de cada mês, a partir de `agora`. Se hoje ainda não passou do dia
 * de pagamento deste mês, o próximo é este mês; senão, é o mês seguinte. */
export function calcularProximoPagamento(diaMes: number, agora: Date = new Date()): string {
  const ano = agora.getFullYear();
  const mes = agora.getMonth() + 1; // 1-indexado
  const hoje = agora.getDate();

  const diaEsteMs = Math.min(diaMes, ultimoDiaDoMes(ano, mes));
  if (hoje <= diaEsteMs) {
    return formatarDataISO(ano, mes, diaEsteMs);
  }

  const proximoMes = mes === 12 ? 1 : mes + 1;
  const anoProximoMes = mes === 12 ? ano + 1 : ano;
  const diaProximoMes = Math.min(diaMes, ultimoDiaDoMes(anoProximoMes, proximoMes));
  return formatarDataISO(anoProximoMes, proximoMes, diaProximoMes);
}

/** Data prevista (YYYY-MM-DD) do custo fixo NO MÊS DE `agora` — usada pra
 * garantir/buscar a linha de histórico do mês corrente (diferente de
 * `calcularProximoPagamento`, que pode already ser o mês seguinte se o dia
 * já passou). */
export function calcularDataPrevistaMesAtual(diaMes: number, agora: Date = new Date()): string {
  const ano = agora.getFullYear();
  const mes = agora.getMonth() + 1;
  const dia = Math.min(diaMes, ultimoDiaDoMes(ano, mes));
  return formatarDataISO(ano, mes, dia);
}

function formatarDataISO(ano: number, mes: number, dia: number): string {
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}
