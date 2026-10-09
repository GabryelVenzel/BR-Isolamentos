import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SUPABASE_URL } from "@/lib/supabase/env";
import { acessoDeMetadata, podeAcessarModulo } from "@/lib/acesso";
import { BUCKETS_CONHECIDOS, MODULO_DO_BUCKET } from "@/lib/arquivos";
import { apiError } from "@/lib/types/common";

interface Params {
  params: { caminho: string[] };
}

const VALIDADE_SEGUNDOS = 120;

/** GET /api/arquivo/<bucket>/<caminho> — porta de entrada única dos anexos
 * (ver lib/arquivos.ts). Confere sessão e permissão do bucket e redireciona
 * pra um link temporário do Storage; o arquivo em si não passa pelo servidor
 * do app (anexos chegam a 20MB, acima do limite de resposta da Vercel). */
export async function GET(request: Request, { params }: Params) {
  const [bucket, ...partes] = params.caminho;
  const caminho = partes.join("/");

  if (!bucket || !caminho || !(BUCKETS_CONHECIDOS as readonly string[]).includes(bucket)) {
    return NextResponse.json(apiError("Arquivo não encontrado."), { status: 404 });
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json(apiError("Sessão expirada. Entre novamente."), { status: 401 });

  const acesso = acessoDeMetadata(user.app_metadata);
  const moduloExigido = MODULO_DO_BUCKET[bucket];
  if (!acesso.ativo || (moduloExigido && !podeAcessarModulo(acesso, moduloExigido))) {
    return NextResponse.json(apiError("Você não tem permissão para abrir este arquivo."), { status: 403 });
  }

  const baixarComo = new URL(request.url).searchParams.get("baixar");
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(caminho, VALIDADE_SEGUNDOS, baixarComo ? { download: baixarComo } : undefined);

  if (data?.signedUrl) return NextResponse.redirect(data.signedUrl);

  // Transição: enquanto a migração 038 não rodou, o bucket ainda é público e
  // não existe regra de leitura pra assinar o link — cai no endereço público
  // (que para de funcionar sozinho assim que o bucket for fechado).
  const publico = `${SUPABASE_URL()}/storage/v1/object/public/${bucket}/${caminho}`;
  const existe = await fetch(publico, { method: "HEAD" }).then((r) => r.ok).catch(() => false);
  if (existe) return NextResponse.redirect(publico);

  return NextResponse.json(apiError(error?.message ?? "Arquivo não encontrado."), { status: 404 });
}
