import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createComercialContext } from "@/lib/contexts/comercial";
import { apiError, apiSuccess } from "@/lib/types/common";
import { parseFiltrosResumo } from "@/lib/types/api";
import { resolverPeriodo } from "@/lib/usecases/resumo";
import { toHttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";

/** GET: relatório completo da aba "Comercial" do Resumo — KPIs, funil de
 * conversão, tempo médio por etapa, leads por origem, performance por
 * responsável, leads dormindo e resumo de leads frios agendados (ver
 * lib/usecases/comercial/relatorio.ts). Período agora é o MESMO filtro por
 * linhas (Semana/Mês/Ano × Atual/Anterior + Personalizado) da aba Geral —
 * ver `parseFiltrosResumo`/`resolverPeriodo` e components/modules/resumo/
 * FilterBar.tsx. Demais filtros via query string: `atribuido_a`,
 * `temperatura`. */
export async function GET(request: Request) {
  const ctx = createComercialContext(createSupabaseServerClient());
  const { searchParams } = new URL(request.url);

  try {
    const filtros = parseFiltrosResumo(searchParams);
    const intervalo = resolverPeriodo(filtros.periodo, filtros.dataInicioCustom, filtros.dataFimCustom);

    const relatorio = await ctx.gerarRelatorio({
      atribuidoA: searchParams.get("atribuido_a") ?? undefined,
      temperatura: searchParams.get("temperatura") ?? undefined,
      criadosApartirDe: `${intervalo.dataInicio}T00:00:00`,
      criadosAte: `${intervalo.dataFim}T23:59:59`,
    });

    return NextResponse.json(apiSuccess(relatorio));
  } catch (error) {
    logger.error("Falha ao gerar relatório comercial", error);
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
