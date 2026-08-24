import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createFinanceiroContext } from "@/lib/contexts/financeiro";
import { apiError, apiSuccess } from "@/lib/types/common";
import { toHttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import {
  calcularAlertas,
  calcularCustosFixosVsVariaveis,
  calcularDistribuicaoPorCategoria,
  calcularKpisFinanceiro,
  calcularReceitaVsDespesaPorMes,
} from "@/lib/usecases/financeiro";

const DIAS_POR_PERIODO: Record<string, number> = { "30dias": 30, "3meses": 90, "12meses": 365 };

/** GET: relatório financeiro completo — KPIs, distribuição por categoria,
 * custos fixos vs variáveis, receita/despesa por mês, alertas. Filtros:
 * `periodo` (30dias|3meses|12meses, default 12meses), `categoria`, `tipo`. */
export async function GET(request: Request) {
  const ctx = createFinanceiroContext(createSupabaseServerClient());
  const { searchParams } = new URL(request.url);

  try {
    const periodo = searchParams.get("periodo") ?? "12meses";
    const dias = DIAS_POR_PERIODO[periodo] ?? DIAS_POR_PERIODO["12meses"];
    const dataInicio = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const [lancamentos, custosFixosMensal] = await Promise.all([
      ctx.listarLancamentos({
        categoria: searchParams.get("categoria") ?? undefined,
        tipo: searchParams.get("tipo") ?? undefined,
        dataInicio,
      }),
      ctx.custoFixoRepo.totalMensalAtivo(),
    ]);

    const pendentes = lancamentos.filter((l) => !l.pago);

    const relatorio = {
      kpis: calcularKpisFinanceiro(lancamentos, custosFixosMensal),
      distribuicaoReceitas: calcularDistribuicaoPorCategoria(lancamentos, "receita"),
      distribuicaoDespesas: calcularDistribuicaoPorCategoria(lancamentos, "despesa"),
      custosFixosVsVariaveis: calcularCustosFixosVsVariaveis(lancamentos),
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
