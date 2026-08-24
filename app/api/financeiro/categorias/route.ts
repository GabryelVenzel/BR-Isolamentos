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
    const ativoParam = searchParams.get("ativo");
    const categorias = await ctx.listarCategorias({
      tipo: (searchParams.get("tipo") as "receita" | "despesa" | null) ?? undefined,
      ativo: ativoParam === null ? undefined : ativoParam === "true",
    });
    return NextResponse.json(apiSuccess(categorias, { total: categorias.length }));
  } catch (error) {
    logger.error("Falha ao listar categorias de lançamento", error);
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}

export async function POST(request: Request) {
  const ctx = createFinanceiroContext(createSupabaseServerClient());
  const body = await request.json().catch(() => null);

  try {
    const categoria = await ctx.criarCategoria(body);
    logger.info("Categoria de lançamento criada", { id: categoria.id, nome: categoria.nome });
    return NextResponse.json(apiSuccess(categoria), { status: 201 });
  } catch (error) {
    logger.error("Falha ao criar categoria de lançamento", error);
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
