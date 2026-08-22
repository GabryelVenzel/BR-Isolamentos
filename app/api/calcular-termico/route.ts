import { NextResponse } from "next/server";
import { calcularTermico } from "@/lib/usecases/engenharia";
import { toHttpError, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import type { CalcularTermicoInput } from "@/lib/types";

export async function POST(request: Request) {
  const input = (await request.json().catch(() => null)) as CalcularTermicoInput | null;

  try {
    if (!input) throw new ValidationError("Corpo da requisição inválido.");

    const resultado = calcularTermico(input);
    return NextResponse.json(resultado);
  } catch (error) {
    logger.error("Falha ao calcular térmico", error);
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
