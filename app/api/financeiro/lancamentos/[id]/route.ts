import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createFinanceiroContext } from "@/lib/contexts/financeiro";
import { apiError, apiSuccess } from "@/lib/types/common";
import { toHttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { sessao } from "@/lib/api";

interface Params {
  params: { id: string };
}

export async function GET(_request: Request, { params }: Params) {
  const ctx = createFinanceiroContext(createSupabaseServerClient());

  try {
    const lancamento = await ctx.buscarLancamento(params.id);
    return NextResponse.json(apiSuccess(lancamento));
  } catch (error) {
    logger.error("Falha ao buscar lançamento financeiro", error, { id: params.id });
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}

/** PATCH: edita um lançamento (categoria, descrição, valor, data, anexos,
 * vínculos com orçamento/serviço/lead...). Sem use case dedicado — update
 * parcial direto, mesma justificativa de PATCH custos-fixos. */
export async function PATCH(request: Request, { params }: Params) {
  const ctx = createFinanceiroContext(createSupabaseServerClient());
  const body = await request.json().catch(() => null);

  try {
    const lancamento = await ctx.atualizarLancamento(params.id, body ?? {});
    logger.info("Lançamento financeiro atualizado", { id: params.id });
    return NextResponse.json(apiSuccess(lancamento));
  } catch (error) {
    logger.error("Falha ao atualizar lançamento financeiro", error, { id: params.id });
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}

/** DELETE: manda o lançamento pra LIXEIRA (migração 047). Com
 * `?escopo=seguintes`, vão junto as parcelas seguintes do mesmo
 * parcelamento/recorrência que ainda estão em aberto (as já pagas ficam). */
export async function DELETE(request: Request, { params }: Params) {
  const { supabase, email } = await sessao();
  const ctx = createFinanceiroContext(supabase);
  const emDiante = new URL(request.url).searchParams.get("escopo") === "seguintes";

  try {
    const excluidos = emDiante ? await ctx.removerLancamentoEmDiante(params.id, email) : (await ctx.removerLancamento(params.id, email), 1);
    logger.info("Lançamento financeiro enviado para a lixeira", { id: params.id, excluidos, por: email });
    return NextResponse.json(apiSuccess({ ok: true, excluidos }));
  } catch (error) {
    logger.error("Falha ao excluir lançamento financeiro", error, { id: params.id });
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
