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
 *         convenção usada no alerta de "contas vencidas". Desde que
 *         `garantirHistoricoMesAtual` passou a criar um lançamento "a pagar"
 *         de verdade pra todo custo fixo com `dia_mes` definido, esses custos
 *         JÁ caem aqui, no dia certo — ver item (b) pra não contar em dobro;
 *     (b) 1/30 do total mensal só dos custos fixos ATIVOS SEM `dia_mes`
 *         definido (dado antigo, de antes desse campo existir) — pra esses,
 *         não existe um lançamento com data certa pra cair no item (a), então
 *         em vez de jogar o mês inteiro num único dia (o que faria o gráfico
 *         "despencar" artificialmente nesse dia), distribui uniformemente.
 *         Bug relatado: somar aqui o total de TODOS os custos fixos (mesmo os
 *         que já têm `dia_mes`) contava o mesmo custo 2x — uma vez no dia
 *         certo via (a), outra vez "borrifado" via (b).
 */
export async function projecaoCaixa(
  lancamentoRepo: LancamentoFinanceiroRepository,
  custoFixoRepo: CustoFixoRepository
): Promise<ProjecaoCaixaResumo> {
  const [todos, custosFixos] = await Promise.all([lancamentoRepo.listar(), custoFixoRepo.listarTodos()]);

  const pagos = todos.filter((l) => l.pago);
  const naoPagos = todos.filter((l) => !l.pago);
  const saldoHoje = pagos.reduce((acc, l) => acc + (l.tipo === "receita" ? l.valor : -l.valor), 0);
  const custosFixosSemDiaMes = custosFixos.filter((c) => c.ativo && c.dia_mes == null).reduce((acc, c) => acc + c.valor_mensal, 0);
  const custoFixoDiario = custosFixosSemDiaMes / 30;

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
