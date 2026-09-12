import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createRhContext } from "@/lib/contexts/rh";
import { apiError, apiSuccess } from "@/lib/types/common";
import { toHttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import type { StatusFuncionario } from "@/lib/types/domain";

export async function GET(request: Request) {
  const ctx = createRhContext(createSupabaseServerClient());
  const { searchParams } = new URL(request.url);

  try {
    const funcionarios = await ctx.listarFuncionarios({
      status: (searchParams.get("status") as StatusFuncionario | null) ?? undefined,
      busca: searchParams.get("busca") ?? undefined,
    });
    return NextResponse.json(apiSuccess(funcionarios, { total: funcionarios.length }));
  } catch (error) {
    logger.error("Falha ao listar funcionários", error);
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}

export async function POST(request: Request) {
  const ctx = createRhContext(createSupabaseServerClient());
  const body = await request.json().catch(() => null);

  try {
    const funcionario = await ctx.criarFuncionario(body);
    logger.info("Funcionário criado", { id: funcionario.id });
    return NextResponse.json(apiSuccess(funcionario), { status: 201 });
  } catch (error) {
    logger.error("Falha ao criar funcionário", error);
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
