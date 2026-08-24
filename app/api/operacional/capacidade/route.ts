import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createOperacionalContext } from "@/lib/contexts/operacional";
import { apiError, apiSuccess } from "@/lib/types/common";
import { toHttpError, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";

/** GET: capacidade (mobilizado/disponível por parceiro) num dia específico —
 * `?data=YYYY-MM-DD` (obrigatório). Ver lib/usecases/operacional/capacidade.ts. */
export async function GET(request: Request) {
  const ctx = createOperacionalContext(createSupabaseServerClient());
  const { searchParams } = new URL(request.url);
  const data = searchParams.get("data");

  try {
    if (!data) throw new ValidationError("Informe a data (?data=YYYY-MM-DD).");

    const capacidade = await ctx.obterCapacidadeDia(data);
    return NextResponse.json(apiSuccess(capacidade));
  } catch (error) {
    logger.error("Falha ao calcular capacidade do dia", error, { data });
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
