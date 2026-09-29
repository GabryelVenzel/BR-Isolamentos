import { NotFoundError } from "../../errors";
import type { HistoricoCustoFixoRepository, LancamentoFinanceiroRepository } from "../../repositories";
import type { HistoricoCustoFixo, LancamentoFinanceiro } from "../../types/domain";

/** `historicoRepo` é opcional só pra não quebrar quem ainda chama isso sem
 * ele (nenhum caso real hoje) — sempre que disponível, sincroniza o
 * histórico do Custo Fixo se este lançamento nasceu de um (ver
 * garantirLancamentoDoMes). Bug relatado: um custo fixo agora aparece em
 * Lançamentos como "a pagar" assim que vence (não só quando o usuário clica
 * "Marcar como pago" no card do Custo Fixo) — se o usuário confirmar o
 * pagamento por AQUI (botão da própria linha, aba Lançamentos) em vez de lá,
 * o histórico do card ficava "pendente" pra sempre sem essa sincronização. */
export async function marcarComoPago(
  id: string,
  dataPagamento: string | undefined,
  repos: { lancamentoRepo: LancamentoFinanceiroRepository; historicoRepo?: HistoricoCustoFixoRepository }
): Promise<LancamentoFinanceiro> {
  const existente = await repos.lancamentoRepo.findById(id);
  if (!existente) throw new NotFoundError(`Lançamento ${id} não encontrado.`);

  const dataPagamentoFinal = dataPagamento ?? new Date().toISOString().slice(0, 10);

  const lancamento = await repos.lancamentoRepo.update(id, {
    pago: true,
    data_pagamento: dataPagamentoFinal,
  });

  const historico = await repos.historicoRepo?.buscarPorLancamentoId(id);
  if (historico) {
    await repos.historicoRepo!.update(historico.id, {
      status: "pago",
      data_pagamento: dataPagamentoFinal,
    } as Partial<HistoricoCustoFixo>);
  }

  return lancamento;
}
