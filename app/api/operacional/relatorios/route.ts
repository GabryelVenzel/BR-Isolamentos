import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createOperacionalContext } from "@/lib/contexts/operacional";
import { apiError, apiSuccess } from "@/lib/types/common";
import { toHttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const DIAS_POR_PERIODO: Record<string, number> = { "7dias": 7, "30dias": 30 };

/** GET: relatório operacional completo — KPIs, funil de serviços, tempo de
 * execução por tipo, custo real vs orçado, serviços vencidos. Filtros via
 * query string: `periodo` (7dias|30dias|mes, default todos), `tipo_trabalho`,
 * `responsavel_email`. */
export async function GET(request: Request) {
  const ctx = createOperacionalContext(createSupabaseServerClient());
  const { searchParams } = new URL(request.url);

  try {
    const periodo = searchParams.get("periodo") ?? "todos";
    let criadosApartirDe: string | undefined;
    if (periodo === "mes") {
      const agora = new Date();
      criadosApartirDe = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString();
    } else if (DIAS_POR_PERIODO[periodo]) {
      criadosApartirDe = new Date(Date.now() - DIAS_POR_PERIODO[periodo] * 24 * 60 * 60 * 1000).toISOString();
    }

    const relatorio = await ctx.gerarRelatorio({
      criadosApartirDe,
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
