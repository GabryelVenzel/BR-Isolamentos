import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createRhContext } from "@/lib/contexts/rh";
import { apiError, apiSuccess } from "@/lib/types/common";
import { toHttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";

export async function GET() {
  const ctx = createRhContext(createSupabaseServerClient());

  try {
    const documentos = await ctx.listarDocumentosEmpresa();
    return NextResponse.json(apiSuccess(documentos, { total: documentos.length }));
  } catch (error) {
    logger.error("Falha ao listar documentos da empresa", error);
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}

/** POST: registra a URL de um documento já enviado ao Supabase Storage — o
 * upload em si acontece no navegador (ver DocumentosEmpresa.tsx), esta rota
 * só associa nome/URL/metadados. */
export async function POST(request: Request) {
  const supabase = createSupabaseServerClient();
  const ctx = createRhContext(supabase);
  const body = await request.json().catch(() => null);

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const documento = await ctx.anexarDocumentoEmpresa({ ...body, adicionado_por: user?.email ?? null });
    logger.info("Documento da empresa adicionado", { id: documento.id, nome: documento.nome });
    return NextResponse.json(apiSuccess(documento), { status: 201 });
  } catch (error) {
    logger.error("Falha ao adicionar documento da empresa", error);
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
