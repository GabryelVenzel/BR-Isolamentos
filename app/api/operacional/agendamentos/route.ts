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
    const agendamentos = await ctx.listarAgenda({
      status: searchParams.get("status") ?? undefined,
      dataInicio: searchParams.get("data_inicio") ?? undefined,
      dataFim: searchParams.get("data_fim") ?? undefined,
      parceiroId: searchParams.get("parceiro_id") ?? undefined,
    });
    return NextResponse.json(apiSuccess(agendamentos, { total: agendamentos.length }));
  } catch (error) {
    logger.error("Falha ao listar agenda", error);
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}

export async function POST(request: Request) {
  const ctx = createOperacionalContext(createSupabaseServerClient());
  const body = await request.json().catch(() => null);

  try {
    const agendamento = await ctx.criarAgendamento(body);
    logger.info("Agendamento criado", { id: agendamento.id });
    return NextResponse.json(apiSuccess(agendamento), { status: 201 });
  } catch (error) {
    logger.error("Falha ao criar agendamento", error);
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
