import { NotFoundError } from "../../errors";
import type { CustoFixoRepository, HistoricoCustoFixoRepository, LancamentoFinanceiroRepository } from "../../repositories";
import type { CustoFixo, HistoricoCustoFixo, LancamentoFinanceiro } from "../../types/domain";
import { MarcarCustoFixoPagoSchema, parseOrThrow } from "../../validators";
import { calcularDataPrevistaMesAtual } from "./custoFixo";

/** Marca o custo fixo como pago NESTE MÊS: cria o lançamento de despesa
 * correspondente (pra entrar no fluxo de caixa real, ver
 * lib/repositories/lancamento-financeiro.repository.ts) e atualiza (ou cria,
 * se o sweep de `garantirHistoricoMesAtual` ainda não rodou) a linha de
 * histórico do mês com `status = 'pago'` e o `lancamento_id` gerado — é
 * assim que o histórico "sabe" qual lançamento pagou aquele mês. */
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

  const lancamento = await repos.lancamentoRepo.create({
    tipo: "despesa",
    categoria: custoFixo.categoria,
    descricao: custoFixo.descricao,
    valor: custoFixo.valor_mensal,
    data: dataPagamentoFinal,
    pago: true,
    data_pagamento: dataPagamentoFinal,
  } as Partial<LancamentoFinanceiro>);

  const existente = await repos.historicoRepo.buscarPorMes(custoFixoId, dataPrevista);
  const historico = existente
    ? await repos.historicoRepo.update(existente.id, {
        status: "pago",
        data_pagamento: dataPagamentoFinal,
        lancamento_id: lancamento.id,
      } as Partial<HistoricoCustoFixo>)
    : await repos.historicoRepo.create({
        custo_fixo_id: custoFixoId,
        data_prevista: dataPrevista,
        data_pagamento: dataPagamentoFinal,
        valor: custoFixo.valor_mensal,
        status: "pago",
        lancamento_id: lancamento.id,
      } as Partial<HistoricoCustoFixo>);

  return { custoFixo, historico, lancamento };
}

function obterDataHojeBrasilia(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}
