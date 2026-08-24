import type { CustoFixoRepository, HistoricoCustoFixoRepository } from "../../repositories";
import type { HistoricoCustoFixo } from "../../types/domain";
import { calcularDataPrevistaMesAtual } from "./custoFixo";

/** Sweep sob demanda (mesmo padrão de
 * lib/usecases/comercial/verificarReativacoesPendentes.ts): garante que
 * todo custo fixo ATIVO com `dia_mes` definido tem uma linha de histórico
 * pro mês corrente, criando-a como "pendente" se ainda não existir. Chamado
 * no início de GET /api/financeiro/custos-fixos — não pré-gera meses
 * futuros (ver decisão 3 em sql-migration-009-financeiro-completo.sql). */
export async function garantirHistoricoMesAtual(
  repos: { custoFixoRepo: CustoFixoRepository; historicoRepo: HistoricoCustoFixoRepository },
  agora: Date = new Date()
): Promise<void> {
  const custos = await repos.custoFixoRepo.listarTodos();

  for (const custo of custos) {
    if (!custo.ativo || custo.dia_mes == null) continue;

    const dataPrevista = calcularDataPrevistaMesAtual(custo.dia_mes, agora);
    const existente = await repos.historicoRepo.buscarPorMes(custo.id, dataPrevista);
    if (existente) continue;

    await repos.historicoRepo.create({
      custo_fixo_id: custo.id,
      data_prevista: dataPrevista,
      valor: custo.valor_mensal,
      status: "pendente",
    } as Partial<HistoricoCustoFixo>);
  }
}
