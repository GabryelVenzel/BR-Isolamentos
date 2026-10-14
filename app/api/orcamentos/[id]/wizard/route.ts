import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createOrcamentoContext } from "@/lib/contexts/orcamento";
import { toHttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";

interface Params {
  params: { id: string };
}

/** GET: o orçamento + a cópia do wizard guardada ao salvar (migração 049),
 * para a tela de edição reabri-lo no wizard. `estado` vem `null` nos
 * orçamentos anteriores — a tela então reconstrói a partir do orçamento. */
export async function GET(_request: Request, { params }: Params) {
  const ctx = createOrcamentoContext(createSupabaseServerClient());

  try {
    return NextResponse.json(await ctx.buscarParaEditar(params.id));
  } catch (error) {
    logger.error("Falha ao abrir orçamento para edição", error, { id: params.id });
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
