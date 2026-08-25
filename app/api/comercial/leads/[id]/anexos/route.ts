import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createComercialContext } from "@/lib/contexts/comercial";
import { apiError, apiSuccess } from "@/lib/types/common";
import { toHttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";

interface Params {
  params: { id: string };
}

/** GET: lista os documentos anexados ao lead. */
export async function GET(_request: Request, { params }: Params) {
  const ctx = createComercialContext(createSupabaseServerClient());

  try {
    const anexos = await ctx.listarAnexos(params.id);
    return NextResponse.json(apiSuccess(anexos));
  } catch (error) {
    logger.error("Falha ao listar anexos do lead", error, { id: params.id });
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}

/** POST: registra a URL de um documento já enviado ao Supabase Storage — o
 * upload em si acontece no navegador (ver AnexosLead.tsx), esta rota só
 * associa a URL/metadados ao lead. */
export async function POST(request: Request, { params }: Params) {
  const supabase = createSupabaseServerClient();
  const ctx = createComercialContext(supabase);
  const body = await request.json().catch(() => null);

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const anexo = await ctx.anexarArquivoLead({ ...body, lead_id: params.id, adicionado_por: user?.email ?? null });
    logger.info("Anexo adicionado ao lead", { leadId: params.id, nome: anexo.nome_arquivo });
    return NextResponse.json(apiSuccess(anexo), { status: 201 });
  } catch (error) {
    logger.error("Falha ao anexar arquivo ao lead", error, { id: params.id });
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
