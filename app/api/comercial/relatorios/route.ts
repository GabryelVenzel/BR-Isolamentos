import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createComercialContext } from "@/lib/contexts/comercial";
import { apiError, apiSuccess } from "@/lib/types/common";
import { toHttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const DIAS_POR_PERIODO: Record<string, number> = {
  "7dias": 7,
  "30dias": 30,
};

/** GET: relatório completo da aba "Relatórios" — KPIs, funil de conversão,
 * tempo médio por etapa, leads por origem, performance por responsável,
 * leads dormindo e resumo de leads frios agendados (ver
 * lib/usecases/comercial/relatorio.ts). Filtros via query string: `periodo`
 * (7dias | 30dias | mes | todos, default todos), `atribuido_a`,
 * `temperatura`. */
export async function GET(request: Request) {
  const ctx = createComercialContext(createSupabaseServerClient());
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
      atribuidoA: searchParams.get("atribuido_a") ?? undefined,
      temperatura: searchParams.get("temperatura") ?? undefined,
      criadosApartirDe,
    });

    return NextResponse.json(apiSuccess(relatorio));
  } catch (error) {
    logger.error("Falha ao gerar relatório comercial", error);
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
