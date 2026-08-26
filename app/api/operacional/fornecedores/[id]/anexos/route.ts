import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createOperacionalContext } from "@/lib/contexts/operacional";
import { apiError, apiSuccess } from "@/lib/types/common";
import { toHttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";

interface Params {
  params: { id: string };
}

/** GET: lista os documentos anexados ao fornecedor. */
export async function GET(_request: Request, { params }: Params) {
  const ctx = createOperacionalContext(createSupabaseServerClient());

  try {
    const anexos = await ctx.listarAnexosFornecedor(params.id);
    return NextResponse.json(apiSuccess(anexos));
  } catch (error) {
    logger.error("Falha ao listar anexos do fornecedor", error, { id: params.id });
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}

/** POST: registra a URL de um documento já enviado ao Supabase Storage — o
 * upload em si acontece no navegador (ver FornecedorAnexos.tsx), esta rota
 * só associa a URL/metadados ao fornecedor. */
export async function POST(request: Request, { params }: Params) {
  const supabase = createSupabaseServerClient();
  const ctx = createOperacionalContext(supabase);
  const body = await request.json().catch(() => null);

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const anexo = await ctx.anexarArquivoFornecedor({ ...body, fornecedor_id: params.id, adicionado_por: user?.email ?? null });
    logger.info("Anexo adicionado ao fornecedor", { fornecedorId: params.id, nome: anexo.nome_arquivo });
    return NextResponse.json(apiSuccess(anexo), { status: 201 });
  } catch (error) {
    logger.error("Falha ao anexar arquivo ao fornecedor", error, { id: params.id });
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
