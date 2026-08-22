import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createOperacionalContext } from "@/lib/contexts/operacional";
import { apiError, apiSuccess } from "@/lib/types/common";
import { toHttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";

export async function GET(request: Request) {
  const ctx = createOperacionalContext(createSupabaseServerClient());
  const { searchParams } = new URL(request.url);

  try {
    const ativoParam = searchParams.get("ativo");
    const parceiros = await ctx.listarParceiros({
      ativo: ativoParam === null ? undefined : ativoParam === "true",
      cidade: searchParams.get("cidade") ?? undefined,
    });
    return NextResponse.json(apiSuccess(parceiros, { total: parceiros.length }));
  } catch (error) {
    logger.error("Falha ao listar parceiros", error);
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}

export async function POST(request: Request) {
  const ctx = createOperacionalContext(createSupabaseServerClient());
  const body = await request.json().catch(() => null);

  try {
    const parceiro = await ctx.criarParceiro(body);
    logger.info("Parceiro criado", { id: parceiro.id });
    return NextResponse.json(apiSuccess(parceiro), { status: 201 });
  } catch (error) {
    logger.error("Falha ao criar parceiro", error);
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
