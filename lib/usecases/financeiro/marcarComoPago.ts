import { NotFoundError } from "../../errors";
import type { LancamentoFinanceiroRepository } from "../../repositories";
import type { LancamentoFinanceiro } from "../../types/domain";

export async function marcarComoPago(
  id: string,
  dataPagamento: string | undefined,
  repos: { lancamentoRepo: LancamentoFinanceiroRepository }
): Promise<LancamentoFinanceiro> {
  const existente = await repos.lancamentoRepo.findById(id);
  if (!existente) throw new NotFoundError(`Lançamento ${id} não encontrado.`);

  return repos.lancamentoRepo.update(id, {
    pago: true,
    data_pagamento: dataPagamento ?? new Date().toISOString().slice(0, 10),
  });
}
