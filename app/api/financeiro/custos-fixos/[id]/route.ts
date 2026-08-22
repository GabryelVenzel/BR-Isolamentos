import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createFinanceiroContext } from "@/lib/contexts/financeiro";
import { apiError, apiSuccess } from "@/lib/types/common";
import { toHttpError, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";

interface Params {
  params: { id: string };
}

/** PATCH: atualização simples (valor mensal, ativo/inativo) — sem use case
 * dedicado porque é um update parcial direto, sem regra de negócio além da
 * validação de forma já feita pelo repositório/Postgres (NOT NULL, etc.). */
export async function PATCH(request: Request, { params }: Params) {
  const ctx = createFinanceiroContext(createSupabaseServerClient());
  const body = await request.json().catch(() => null);

  try {
    if (!body) throw new ValidationError("Corpo da requisição inválido.");
    const custoFixo = await ctx.atualizarCustoFixo(params.id, body);
    logger.info("Custo fixo atualizado", { id: params.id });
    return NextResponse.json(apiSuccess(custoFixo));
  } catch (error) {
    logger.error("Falha ao atualizar custo fixo", error, { id: params.id });
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
