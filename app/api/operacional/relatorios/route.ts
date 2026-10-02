import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createOperacionalContext } from "@/lib/contexts/operacional";
import { apiError, apiSuccess } from "@/lib/types/common";
import { parseFiltrosResumo } from "@/lib/types/api";
import { resolverPeriodo } from "@/lib/usecases/resumo";
import { toHttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";

/** GET: relatório operacional completo — KPIs, funil de serviços, tempo de
 * execução por tipo, custo real vs orçado, serviços vencidos. Período agora é
 * o MESMO filtro por linhas (Semana/Mês/Ano × Atual/Anterior + Personalizado)
 * da aba Geral — ver `parseFiltrosResumo`/`resolverPeriodo` e
 * components/modules/resumo/FilterBar.tsx. Demais filtros via query string:
 * `tipo_trabalho`, `responsavel_email`. */
export async function GET(request: Request) {
  const ctx = createOperacionalContext(createSupabaseServerClient());
  const { searchParams } = new URL(request.url);

  try {
    const filtros = parseFiltrosResumo(searchParams);
    const intervalo = resolverPeriodo(filtros.periodo, filtros.dataInicioCustom, filtros.dataFimCustom);

    const relatorio = await ctx.gerarRelatorio({
      criadosApartirDe: `${intervalo.dataInicio}T00:00:00`,
      criadosAte: `${intervalo.dataFim}T23:59:59`,
      tipoTrabalho: searchParams.get("tipo_trabalho") ?? undefined,
      responsavelEmail: searchParams.get("responsavel_email") ?? undefined,
    });

    return NextResponse.json(apiSuccess(relatorio));
  } catch (error) {
    logger.error("Falha ao gerar relatório operacional", error);
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
