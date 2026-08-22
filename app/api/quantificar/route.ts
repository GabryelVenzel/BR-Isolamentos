import { NextResponse } from "next/server";
import { quantificar } from "@/lib/usecases/engenharia";
import { toHttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import type { QuantificarInput } from "@/lib/types";

export async function POST(request: Request) {
  const input = (await request.json().catch(() => null)) as QuantificarInput | null;

  try {
    const resultado = quantificar(input as QuantificarInput);
    return NextResponse.json(resultado);
  } catch (error) {
    logger.error("Falha ao quantificar materiais", error);
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
