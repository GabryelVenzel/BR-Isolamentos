import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createOperacionalContext } from "@/lib/contexts/operacional";
import { apiError, apiSuccess } from "@/lib/types/common";
import { toHttpError, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";

/** GET: resumo de capacidade dia-a-dia de um mês inteiro — `?ano=2026&mes=8`
 * (ambos obrigatórios, mes 1-12). Base do calendário visual da aba Agenda
 * (ver lib/usecases/operacional/capacidade.ts#calcularCapacidadeMes). Para o
 * detalhe de UM dia (por parceiro), ver /api/operacional/capacidade. */
export async function GET(request: Request) {
  const ctx = createOperacionalContext(createSupabaseServerClient());
  const { searchParams } = new URL(request.url);
  const ano = Number(searchParams.get("ano"));
  const mes = Number(searchParams.get("mes"));

  try {
    if (!ano || !mes || mes < 1 || mes > 12) {
      throw new ValidationError("Informe ano e mês válidos (?ano=2026&mes=8).");
    }

    const resumo = await ctx.obterCapacidadeMes(ano, mes);
    return NextResponse.json(apiSuccess(resumo));
  } catch (error) {
    logger.error("Falha ao calcular capacidade do mês", error, { ano, mes });
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
