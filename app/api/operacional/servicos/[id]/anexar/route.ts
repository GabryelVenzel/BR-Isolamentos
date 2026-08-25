import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createOperacionalContext } from "@/lib/contexts/operacional";
import { apiError, apiSuccess } from "@/lib/types/common";
import { toHttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";

interface Params {
  params: { id: string };
}

/** POST: grava a URL de um arquivo já enviado ao Supabase Storage — o
 * upload em si acontece no navegador (ver
 * components/modules/operacional/ServicoDetailModal.tsx), esta rota só
 * associa a URL resultante ao serviço. Corpo:
 * `{ campo: "foto_principal_url"|"pdf_relatorio_url"|"fotos_url", url: string }`. */
export async function POST(request: Request, { params }: Params) {
  const supabase = createSupabaseServerClient();
  const ctx = createOperacionalContext(supabase);
  const body = await request.json().catch(() => null);

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const servico = await ctx.anexarArquivoServico(params.id, body, user?.email ?? null);
    logger.info("Arquivo anexado ao serviço", { id: params.id, campo: body?.campo });
    return NextResponse.json(apiSuccess(servico));
  } catch (error) {
    logger.error("Falha ao anexar arquivo ao serviço", error, { id: params.id });
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}

/** DELETE: desassocia a URL de um anexo do serviço — o arquivo em si já foi
 * removido do Storage pelo chamador antes desta chamada (ver
 * ServicoDetailModal.tsx). Corpo: `{ campo, url? }` (`url` obrigatória só
 * para `fotos_url`, que é um array). */
export async function DELETE(request: Request, { params }: Params) {
  const supabase = createSupabaseServerClient();
  const ctx = createOperacionalContext(supabase);
  const body = await request.json().catch(() => null);

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const servico = await ctx.removerArquivoServico(params.id, body, user?.email ?? null);
    logger.info("Arquivo removido do serviço", { id: params.id, campo: body?.campo });
    return NextResponse.json(apiSuccess(servico));
  } catch (error) {
    logger.error("Falha ao remover arquivo do serviço", error, { id: params.id });
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
