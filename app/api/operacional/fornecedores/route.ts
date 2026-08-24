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
    const fornecedores = await ctx.listarFornecedores({
      ativo: ativoParam === null ? undefined : ativoParam === "true",
      busca: searchParams.get("busca") ?? undefined,
    });
    return NextResponse.json(apiSuccess(fornecedores, { total: fornecedores.length }));
  } catch (error) {
    logger.error("Falha ao listar fornecedores", error);
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}

export async function POST(request: Request) {
  const ctx = createOperacionalContext(createSupabaseServerClient());
  const body = await request.json().catch(() => null);

  try {
    const fornecedor = await ctx.criarFornecedor(body);
    logger.info("Fornecedor criado", { id: fornecedor.id });
    return NextResponse.json(apiSuccess(fornecedor), { status: 201 });
  } catch (error) {
    logger.error("Falha ao criar fornecedor", error);
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
