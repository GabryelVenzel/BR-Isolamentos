import { NotFoundError } from "../../errors";
import type { CustoFixoRepository, HistoricoCustoFixoRepository, LancamentoFinanceiroRepository } from "../../repositories";
import type { CustoFixo, HistoricoCustoFixo, LancamentoFinanceiro } from "../../types/domain";
import { MarcarCustoFixoPagoSchema, parseOrThrow } from "../../validators";
import { calcularDataPrevistaMesAtual } from "./custoFixo";
import { garantirLancamentoDoMes } from "./garantirHistoricoMesAtual";

/** Marca o custo fixo como pago NESTE MÊS: ATUALIZA (não cria) o lançamento
 * "a pagar" que já existe desde que o custo venceu (ver
 * `garantirLancamentoDoMes`/`garantirHistoricoMesAtual` — se por algum motivo
 * o sweep ainda não rodou pra este mês, ele é criado aqui na hora) e marca o
 * histórico do mês com `status = 'pago'`. O anexo/comprovante continua sendo
 * subido manualmente depois, direto no lançamento (aba Lançamentos). */
export async function marcarCustoFixoPago(
  custoFixoId: string,
  input: unknown,
  repos: {
    custoFixoRepo: CustoFixoRepository;
    historicoRepo: HistoricoCustoFixoRepository;
    lancamentoRepo: LancamentoFinanceiroRepository;
  }
): Promise<{ custoFixo: CustoFixo; historico: HistoricoCustoFixo; lancamento: LancamentoFinanceiro }> {
  const { dataPagamento } = parseOrThrow(MarcarCustoFixoPagoSchema, input ?? {});

  const custoFixo = await repos.custoFixoRepo.findById(custoFixoId);
  if (!custoFixo) throw new NotFoundError(`Custo fixo ${custoFixoId} não encontrado.`);

  const agora = new Date();
  const dataPagamentoFinal = dataPagamento ?? obterDataHojeBrasilia();
  const dataPrevista = custoFixo.dia_mes != null ? calcularDataPrevistaMesAtual(custoFixo.dia_mes, agora) : dataPagamentoFinal;

  const { historico: pendente } = await garantirLancamentoDoMes(custoFixo, dataPrevista, repos);

  const lancamento = await repos.lancamentoRepo.update(pendente.lancamento_id as string, {
    pago: true,
    data_pagamento: dataPagamentoFinal,
  } as Partial<LancamentoFinanceiro>);

  const historico = await repos.historicoRepo.update(pendente.id, {
    status: "pago",
    data_pagamento: dataPagamentoFinal,
  } as Partial<HistoricoCustoFixo>);

  return { custoFixo, historico, lancamento };
}

function obterDataHojeBrasilia(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}
