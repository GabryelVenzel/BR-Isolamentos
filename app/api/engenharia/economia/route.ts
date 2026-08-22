import { NextResponse } from "next/server";
import { calcularEconomia } from "@/lib/usecases/engenharia";
import { apiError, apiSuccess } from "@/lib/types/common";
import { toHttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";

/** POST: economia de energia/CO2 a partir de um resultado já calculado no
 * painel Quente (ver lib/usecases/engenharia/calcularEconomia.ts). Só faz
 * sentido pro painel Quente — não existe rota equivalente pro Frio (ver
 * checklist do módulo: análise de economia pro modo frio fica pra uma fase
 * futura). */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  try {
    const resultado = calcularEconomia(body);
    return NextResponse.json(apiSuccess(resultado));
  } catch (error) {
    logger.error("Falha ao calcular economia (Engenharia)", error);
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
