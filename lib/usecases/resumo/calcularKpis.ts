import type {
  CustoFixoRepository,
  LancamentoFinanceiroRepository,
  LeadRepository,
} from "../../repositories";
import type { FiltrosResumo, KpisResumo } from "../../types/resumo";
import { calcularTendencia, periodoAnterior, resolverPeriodo } from "./periodo";

export interface ReposKpis {
  lancamentoRepo: LancamentoFinanceiroRepository;
  leadRepo: LeadRepository;
  custoFixoRepo: CustoFixoRepository;
}

/**
 * Agrega os 6 KPIs do dashboard executivo (módulo Resumo) pro período/tipo/
 * responsável selecionados na FilterBar. Ver lib/types/resumo.ts (KpisResumo)
 * pra forma exata do retorno, e o comentário no topo de cada bloco abaixo
 * pras decisões de modelagem que fogem do que foi pedido literalmente
 * (documentadas porque o schema real não tem todos os campos que o pedido
 * original assumia — ex.: não existe meta de receita configurada em
 * `config_empresa`, nem `data_vencimento` em `lancamentos_financeiros`).
 */
export async function calcularKpis(filtros: FiltrosResumo, repos: ReposKpis): Promise<KpisResumo> {
  const { lancamentoRepo, leadRepo, custoFixoRepo } = repos;
  const intervalo = resolverPeriodo(filtros.periodo, filtros.dataInicioCustom, filtros.dataFimCustom);
  const anterior = periodoAnterior(intervalo);
  const opts = { tipoTrabalho: filtros.tipoTrabalho, responsavel: filtros.responsavel };

  // --- 1. Receita ---
  const [receitaAtual, receitaAnterior] = await Promise.all([
    lancamentoRepo.somarPorTipo("receita", intervalo.dataInicio, intervalo.dataFim, opts),
    lancamentoRepo.somarPorTipo("receita", anterior.dataInicio, anterior.dataFim, opts),
  ]);

  // --- 2. Leads ativos ---
  // `tipoTrabalho` não filtra leads (um lead ainda não tem tipo de trabalho
  // definido — isso só existe a partir do orçamento) — o filtro é ignorado
  // aqui de propósito, não por omissão.
  const [leadsAtivos, novosNoPeriodo] = await Promise.all([
    leadRepo.listarAtivos(filtros.responsavel),
    leadRepo.contarCriadosNoIntervalo(intervalo.dataInicio, intervalo.dataFim, filtros.responsavel),
  ]);
  const valorEmProspeccao = leadsAtivos
    .filter((l) => l.etapa === "prospeccao")
    .reduce((acc, l) => acc + l.valor_estimado, 0);

  // --- 3. Fechados no período ---
  const [fechadosAtual, fechadosAnterior, leadsCriadosNoPeriodo] = await Promise.all([
    leadRepo.listarPorEtapaNoIntervalo("fechado", intervalo.dataInicio, intervalo.dataFim, filtros.responsavel),
    leadRepo.listarPorEtapaNoIntervalo("fechado", anterior.dataInicio, anterior.dataFim, filtros.responsavel),
    leadRepo.contarCriadosNoIntervalo(intervalo.dataInicio, intervalo.dataFim, filtros.responsavel),
  ]);
  const valorFechadosAtual = fechadosAtual.reduce((acc, l) => acc + l.valor_estimado, 0);
  // Conversão do período: fechados que entraram nessa janela / leads criados
  // na mesma janela. É uma aproximação (um lead fechado no período pode ter
  // sido criado antes dele) — uma taxa histórica "de verdade" precisaria de
  // cohort tracking que a tabela não guarda hoje.
  const taxaConversao = leadsCriadosNoPeriodo > 0 ? (fechadosAtual.length / leadsCriadosNoPeriodo) * 100 : 0;

  // --- 4. A receber ---
  const aReceber = await lancamentoRepo.listarAReceber();
  const aReceberFiltrado = aReceber.filter((l) => {
    if (filtros.tipoTrabalho && l.orcamento?.tipo_trabalho !== filtros.tipoTrabalho) return false;
    if (filtros.responsavel && l.orcamento?.atribuido_a !== filtros.responsavel) return false;
    return true;
  });
  const hojeISO = new Date().toISOString().slice(0, 10);
  const vencidas = aReceberFiltrado.filter((l) => l.data < hojeISO);

  // --- 5. Despesas do período ---
  const [despesaAtual, despesaAnterior, custosFixos] = await Promise.all([
    lancamentoRepo.somarPorTipo("despesa", intervalo.dataInicio, intervalo.dataFim, opts),
    lancamentoRepo.somarPorTipo("despesa", anterior.dataInicio, anterior.dataFim, opts),
    custoFixoRepo.totalMensalAtivo(),
  ]);

  // --- 6. Saldo do período + mini-tendência dos últimos 3 meses ---
  const saldoAtual = receitaAtual - despesaAtual;
  const margemPercentual = receitaAtual > 0 ? (saldoAtual / receitaAtual) * 100 : null;
  const status: KpisResumo["saldo"]["status"] =
    saldoAtual < 0 ? "critico" : margemPercentual !== null && margemPercentual < 15 ? "atencao" : "saudavel";

  const ultimosTresMeses = await calcularSaldoUltimosMeses(lancamentoRepo, 3);

  return {
    periodoLabel: intervalo.label,
    receita: { valor: receitaAtual, tendencia: calcularTendencia(receitaAtual, receitaAnterior) },
    leadsAtivos: {
      quantidade: leadsAtivos.length,
      valorEmProspeccao,
      novosNoPeriodo,
    },
    fechados: {
      quantidade: fechadosAtual.length,
      valorEstimado: valorFechadosAtual,
      taxaConversaoPercentual: taxaConversao,
      tendencia: calcularTendencia(fechadosAtual.length, fechadosAnterior.length),
    },
    aReceber: {
      valor: aReceberFiltrado.reduce((acc, l) => acc + l.valor, 0),
      quantidadeFaturas: aReceberFiltrado.length,
      vencidas: { quantidade: vencidas.length, valor: vencidas.reduce((acc, l) => acc + l.valor, 0) },
    },
    despesas: {
      valor: despesaAtual,
      custosFixosConfigurados: custosFixos,
      tendencia: calcularTendencia(despesaAtual, despesaAnterior),
    },
    saldo: {
      valor: saldoAtual,
      margemPercentual,
      status,
      ultimosTresMeses,
    },
  };
}

/** Saldo (receita - despesa) de cada um dos últimos `n` meses fechados,
 * incluindo o mês corrente (parcial) como último ponto — pequeno sparkline
 * do card de saldo, sempre nos últimos 3 meses independente do período
 * selecionado na FilterBar (é um indicador de tendência recente fixo, igual
 * ao gráfico Receita x Despesa). */
async function calcularSaldoUltimosMeses(repo: LancamentoFinanceiroRepository, n: number): Promise<number[]> {
  const hoje = new Date();
  const resultados: number[] = [];

  for (let i = n - 1; i >= 0; i--) {
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const fimMes = i === 0 ? hoje : new Date(hoje.getFullYear(), hoje.getMonth() - i + 1, 0);
    const inicioISO = inicioMes.toISOString().slice(0, 10);
    const fimISO = fimMes.toISOString().slice(0, 10);

    const [receita, despesa] = await Promise.all([
      repo.somarPorTipo("receita", inicioISO, fimISO),
      repo.somarPorTipo("despesa", inicioISO, fimISO),
    ]);
    resultados.push(receita - despesa);
  }

  return resultados;
}
