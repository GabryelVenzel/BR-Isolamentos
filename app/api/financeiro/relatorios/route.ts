import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createFinanceiroContext } from "@/lib/contexts/financeiro";
import { apiError, apiSuccess } from "@/lib/types/common";
import { parseFiltrosResumo } from "@/lib/types/api";
import { resolverPeriodo } from "@/lib/usecases/resumo";
import { toHttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { calcularAlertas, calcularDistribuicaoPorCategoria, calcularKpisFinanceiro, calcularReceitaVsDespesaPorMes } from "@/lib/usecases/financeiro";

/** GET: relatório financeiro completo — KPIs, distribuição por categoria,
 * receita/despesa por mês, alertas. Custos Fixos x Variáveis saiu daqui
 * (pedido explícito, rodada "inverter gráficos de aba") — foi pra
 * `/api/resumo/charts/custos-fixos-variaveis` (aba Geral do Resumo); a aba
 * Financeira ganhou a Projeção de Caixa no lugar (ver DashboardFinanceira.tsx).
 * Período agora é o MESMO filtro por linhas (Semana/Mês/Ano × Atual/Anterior +
 * Personalizado) da aba Geral do Resumo — ver `parseFiltrosResumo`/
 * `resolverPeriodo` e components/modules/resumo/FilterBar.tsx.
 * `lancamentos_financeiros.data` é uma coluna DATE (não timestamp), então
 * `dataInicio`/`dataFim` (YYYY-MM-DD) entram direto em `listarLancamentos`,
 * sem o ajuste de "T23:59:59" que as rotas de Comercial/Operação precisam
 * pra `created_at` (timestamp). Demais filtros via query string: `categoria`,
 * `tipo`. */
export async function GET(request: Request) {
  const ctx = createFinanceiroContext(createSupabaseServerClient());
  const { searchParams } = new URL(request.url);

  try {
    const filtros = parseFiltrosResumo(searchParams);
    const intervalo = resolverPeriodo(filtros.periodo, filtros.dataInicioCustom, filtros.dataFimCustom);

    const [lancamentos, custosFixosMensal] = await Promise.all([
      ctx.listarLancamentos({
        categoria: searchParams.get("categoria") ?? undefined,
        tipo: searchParams.get("tipo") ?? undefined,
        dataInicio: intervalo.dataInicio,
        dataFim: intervalo.dataFim,
      }),
      ctx.custoFixoRepo.totalMensalAtivo(),
    ]);

    const pendentes = lancamentos.filter((l) => !l.pago);

    const relatorio = {
      kpis: calcularKpisFinanceiro(lancamentos, custosFixosMensal),
      distribuicaoReceitas: calcularDistribuicaoPorCategoria(lancamentos, "receita"),
      distribuicaoDespesas: calcularDistribuicaoPorCategoria(lancamentos, "despesa"),
      receitaVsDespesaPorMes: calcularReceitaVsDespesaPorMes(lancamentos),
      alertas: calcularAlertas(pendentes),
    };

    return NextResponse.json(apiSuccess(relatorio));
  } catch (error) {
    logger.error("Falha ao gerar relatório financeiro", error);
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
