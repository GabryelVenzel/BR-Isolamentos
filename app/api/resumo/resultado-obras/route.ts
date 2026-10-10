import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createFinanceiroObraContext } from "@/lib/contexts/financeiro-obra";
import { apiError, apiSuccess } from "@/lib/types/common";
import { toHttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";

/** GET: resultado financeiro de todas as obras (orçado, recebido, gasto e
 * margem real) — sem filtro de período: uma obra atravessa meses e o que
 * interessa é o resultado dela inteira. */
export async function GET() {
  const ctx = createFinanceiroObraContext(createSupabaseServerClient());
  try {
    const obras = await ctx.resultadoPorObra();
    return NextResponse.json(apiSuccess(obras, { total: obras.length }));
  } catch (error) {
    logger.error("Falha ao calcular resultado por obra", error);
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
