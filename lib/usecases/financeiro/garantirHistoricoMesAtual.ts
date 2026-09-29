import type { CustoFixoRepository, HistoricoCustoFixoRepository, LancamentoFinanceiroRepository } from "../../repositories";
import type { CustoFixo, HistoricoCustoFixo, LancamentoFinanceiro } from "../../types/domain";
import { calcularDataPrevistaMesAtual } from "./custoFixo";

type ReposCustoFixo = {
  custoFixoRepo: CustoFixoRepository;
  historicoRepo: HistoricoCustoFixoRepository;
  lancamentoRepo: LancamentoFinanceiroRepository;
};

/** Garante que o custo fixo tem, para `dataPrevista`, um par histórico +
 * lançamento já existindo — criando os dois (linkados) se ainda não
 * existirem. Pedido explícito: o custo fixo deve contar no fluxo de caixa
 * (aba Lançamentos) assim que "vence", como uma despesa "a pagar" (`pago:
 * false`, sem anexo — o comprovante é anexado manualmente depois, na hora de
 * confirmar o pagamento) — não só no momento em que o usuário confirma que já
 * pagou. Usada tanto pelo sweep abaixo quanto por `marcarCustoFixoPago`
 * (que precisa do lançamento já existente pra ATUALIZAR em vez de duplicar). */
export async function garantirLancamentoDoMes(
  custoFixo: CustoFixo,
  dataPrevista: string,
  repos: Pick<ReposCustoFixo, "historicoRepo" | "lancamentoRepo">
): Promise<{ historico: HistoricoCustoFixo; lancamento: LancamentoFinanceiro }> {
  const existente = await repos.historicoRepo.buscarPorMes(custoFixo.id, dataPrevista);
  if (existente?.lancamento_id) {
    // `findById` (não `findByIdOrThrow`): se o usuário excluiu esse
    // lançamento direto pela aba Lançamentos, cai no bloco abaixo e recria em
    // vez de quebrar a tela com um erro.
    const lancamento = await repos.lancamentoRepo.findById(existente.lancamento_id);
    if (lancamento) return { historico: existente, lancamento };
  }

  const lancamento = await repos.lancamentoRepo.create({
    tipo: "despesa",
    categoria: custoFixo.categoria,
    descricao: custoFixo.descricao,
    valor: custoFixo.valor_mensal,
    data: dataPrevista,
    pago: false,
    data_pagamento: null,
  } as Partial<LancamentoFinanceiro>);

  const historico = existente
    ? await repos.historicoRepo.update(existente.id, { lancamento_id: lancamento.id } as Partial<HistoricoCustoFixo>)
    : await repos.historicoRepo.create({
        custo_fixo_id: custoFixo.id,
        data_prevista: dataPrevista,
        valor: custoFixo.valor_mensal,
        status: "pendente",
        lancamento_id: lancamento.id,
      } as Partial<HistoricoCustoFixo>);

  return { historico, lancamento };
}

/** Sweep sob demanda (mesmo padrão de
 * lib/usecases/comercial/verificarReativacoesPendentes.ts): garante que todo
 * custo fixo ATIVO com `dia_mes` definido tem, pro mês corrente, uma linha de
 * histórico E um lançamento "a pagar" em Lançamentos (ver
 * `garantirLancamentoDoMes` acima). Chamado no início de GET
 * /api/financeiro/custos-fixos — não pré-gera meses futuros (ver decisão 3
 * em sql-migration-009-financeiro-completo.sql). */
export async function garantirHistoricoMesAtual(repos: ReposCustoFixo, agora: Date = new Date()): Promise<void> {
  const custos = await repos.custoFixoRepo.listarTodos();

  for (const custo of custos) {
    if (!custo.ativo || custo.dia_mes == null) continue;

    const dataPrevista = calcularDataPrevistaMesAtual(custo.dia_mes, agora);
    await garantirLancamentoDoMes(custo, dataPrevista, repos);
  }
}
