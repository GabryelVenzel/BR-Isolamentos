import type { CustoFixoRepository, LancamentoFinanceiroRepository } from "../../repositories";
import type { DiaCashFlow, ProjecaoCaixaResumo } from "../../types/resumo";

const DIAS_PROJECAO = 30;

/**
 * Projeção de caixa pros próximos 30 dias. Metodologia (documentada porque a
 * tabela não guarda um "saldo em conta" real — é derivada, não um dado direto):
 *
 *   saldo de hoje = soma histórica de tudo já PAGO (receita paga - despesa
 *   paga, `pago = true`) — a posição de caixa acumulada a partir do que
 *   realmente já entrou/saiu, é a aproximação mais correta disponível sem
 *   integração bancária.
 *
 *   cada um dos 30 dias seguintes soma:
 *     (a) lançamentos NÃO pagos cuja `data` cai naquele dia (receita soma,
 *         despesa subtrai) — `data` como proxy de vencimento, mesma
 *         convenção usada no alerta de "contas vencidas";
 *     (b) 1/30 do total mensal de custos fixos ativos, todo dia — os custos
 *         fixos não têm dia de vencimento cadastrado, então em vez de jogar
 *         o mês inteiro num único dia (o que faria o gráfico "despencar"
 *         artificialmente nesse dia), distribui uniformemente.
 */
export async function projecaoCaixa(
  lancamentoRepo: LancamentoFinanceiroRepository,
  custoFixoRepo: CustoFixoRepository
): Promise<ProjecaoCaixaResumo> {
  const [todos, custosFixosMensal] = await Promise.all([lancamentoRepo.listar(), custoFixoRepo.totalMensalAtivo()]);

  const pagos = todos.filter((l) => l.pago);
  const naoPagos = todos.filter((l) => !l.pago);
  const saldoHoje = pagos.reduce((acc, l) => acc + (l.tipo === "receita" ? l.valor : -l.valor), 0);
  const custoFixoDiario = custosFixosMensal / 30;

  const hoje = new Date();
  const dias: DiaCashFlow[] = [];
  let saldoAcumulado = saldoHoje;
  let primeiroDiaNegativo: number | null = null;

  for (let i = 1; i <= DIAS_PROJECAO; i++) {
    const data = new Date(hoje);
    data.setDate(data.getDate() + i);
    const dataISO = data.toISOString().slice(0, 10);

    const movimentoDoDia = naoPagos
      .filter((l) => l.data === dataISO)
      .reduce((acc, l) => acc + (l.tipo === "receita" ? l.valor : -l.valor), 0);

    saldoAcumulado += movimentoDoDia - custoFixoDiario;

    const negativo = saldoAcumulado < 0;
    if (negativo && primeiroDiaNegativo === null) primeiroDiaNegativo = i;

    dias.push({ dia: i, data: dataISO, saldoProjetado: saldoAcumulado, negativo });
  }

  return {
    dias,
    saldoHoje,
    saldoFinalPeriodo: saldoAcumulado,
    diasNegativos: dias.filter((d) => d.negativo).length,
    primeiroDiaNegativo: primeiroDiaNegativo !== null ? dias[primeiroDiaNegativo - 1].data : null,
  };
}
