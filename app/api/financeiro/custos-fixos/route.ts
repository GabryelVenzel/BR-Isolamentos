import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createFinanceiroContext } from "@/lib/contexts/financeiro";
import { apiError, apiSuccess } from "@/lib/types/common";
import { toHttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";

export async function GET() {
  const ctx = createFinanceiroContext(createSupabaseServerClient());

  try {
    const custosFixos = await ctx.listarCustosFixos();
    return NextResponse.json(apiSuccess(custosFixos, { total: custosFixos.length }));
  } catch (error) {
    logger.error("Falha ao listar custos fixos", error);
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}

export async function POST(request: Request) {
  const ctx = createFinanceiroContext(createSupabaseServerClient());
  const body = await request.json().catch(() => null);

  try {
    const custoFixo = await ctx.criarCustoFixo(body);
    logger.info("Custo fixo criado", { id: custoFixo.id, categoria: custoFixo.categoria });
    return NextResponse.json(apiSuccess(custoFixo), { status: 201 });
  } catch (error) {
    logger.error("Falha ao criar custo fixo", error);
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
