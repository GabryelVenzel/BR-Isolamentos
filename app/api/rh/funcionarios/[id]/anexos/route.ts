import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createRhContext } from "@/lib/contexts/rh";
import { apiError, apiSuccess } from "@/lib/types/common";
import { toHttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";

interface Params {
  params: { id: string };
}

/** GET: lista os documentos anexados ao funcionário. */
export async function GET(_request: Request, { params }: Params) {
  const ctx = createRhContext(createSupabaseServerClient());

  try {
    const anexos = await ctx.listarAnexosFuncionario(params.id);
    return NextResponse.json(apiSuccess(anexos));
  } catch (error) {
    logger.error("Falha ao listar anexos do funcionário", error, { id: params.id });
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}

/** POST: registra a URL de um documento já enviado ao Supabase Storage — o
 * upload em si acontece no navegador (ver FuncionarioAnexos.tsx), esta rota
 * só associa nome/URL/metadados ao funcionário. */
export async function POST(request: Request, { params }: Params) {
  const supabase = createSupabaseServerClient();
  const ctx = createRhContext(supabase);
  const body = await request.json().catch(() => null);

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const anexo = await ctx.anexarArquivoFuncionario({ ...body, funcionario_id: params.id, adicionado_por: user?.email ?? null });
    logger.info("Anexo adicionado ao funcionário", { funcionarioId: params.id, nome: anexo.nome });
    return NextResponse.json(apiSuccess(anexo), { status: 201 });
  } catch (error) {
    logger.error("Falha ao anexar arquivo ao funcionário", error, { id: params.id });
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
