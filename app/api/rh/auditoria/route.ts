import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAcessosContext } from "@/lib/contexts/acessos";
import { apiError, apiSuccess } from "@/lib/types/common";
import { toHttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";

/** GET: registro de alterações (quem incluiu, alterou ou excluiu o quê),
 * paginado — só administradores. */
export async function GET(request: Request) {
  const ctx = createAcessosContext(createSupabaseServerClient());
  const { searchParams } = new URL(request.url);
  try {
    const resultado = await ctx.listarAuditoria({
      tabela: searchParams.get("tabela") ?? undefined,
      usuarioEmail: searchParams.get("usuario") ?? undefined,
      acao: searchParams.get("acao") ?? undefined,
      dataInicio: searchParams.get("de") ?? undefined,
      dataFim: searchParams.get("ate") ?? undefined,
      page: Number(searchParams.get("pagina")) || 1,
    });
    return NextResponse.json(
      apiSuccess(resultado.data, { total: resultado.total, page: resultado.page, pageSize: resultado.pageSize })
    );
  } catch (error) {
    logger.error("Falha ao listar auditoria", error);
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
