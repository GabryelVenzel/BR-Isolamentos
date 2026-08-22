import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createFinanceiroContext } from "@/lib/contexts/financeiro";
import { apiError, apiSuccess } from "@/lib/types/common";
import { toHttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";

export async function GET(request: Request) {
  const ctx = createFinanceiroContext(createSupabaseServerClient());
  const { searchParams } = new URL(request.url);

  try {
    const pagoParam = searchParams.get("pago");
    const lancamentos = await ctx.listarLancamentos({
      tipo: searchParams.get("tipo") ?? undefined,
      categoria: searchParams.get("categoria") ?? undefined,
      pago: pagoParam === null ? undefined : pagoParam === "true",
      dataInicio: searchParams.get("data_inicio") ?? undefined,
      dataFim: searchParams.get("data_fim") ?? undefined,
    });
    return NextResponse.json(apiSuccess(lancamentos, { total: lancamentos.length }));
  } catch (error) {
    logger.error("Falha ao listar lançamentos financeiros", error);
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}

export async function POST(request: Request) {
  const ctx = createFinanceiroContext(createSupabaseServerClient());
  const body = await request.json().catch(() => null);

  try {
    const lancamento = await ctx.criarLancamento(body);
    logger.info("Lançamento financeiro criado", { id: lancamento.id, tipo: lancamento.tipo });
    return NextResponse.json(apiSuccess(lancamento), { status: 201 });
  } catch (error) {
    logger.error("Falha ao criar lançamento financeiro", error);
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
