import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseMiddlewareClient } from "@/lib/supabase/middleware";
import { acessoDeMetadata, podeAcessarRota, rotaInicial } from "@/lib/acesso";
import { apiError } from "@/lib/types/common";

const PUBLIC_PATHS = ["/login"];
const ROTA_TROCAR_SENHA = "/conta/senha";
const ROTA_SEM_ACESSO = "/sem-acesso";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request: { headers: request.headers } });

  // A checagem de sessão aqui é "best effort": se o Supabase (ou as env vars)
  // estiverem indisponíveis, deixamos a requisição passar em vez de derrubar
  // o site inteiro com um 500 (MIDDLEWARE_INVOCATION_FAILED). Nesse caso quem
  // segura os dados são as regras de acesso do banco.
  try {
    const supabase = createSupabaseMiddlewareClient(request, response);

    // `getUser()` consulta o servidor de Auth (não confia só no cookie), então
    // o `app_metadata` lido aqui é o atual — desativar um usuário ou tirar um
    // módulo vale já na próxima requisição dele.
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { pathname } = request.nextUrl;
    const isPublic = PUBLIC_PATHS.some((path) => pathname.startsWith(path));
    const isApi = pathname.startsWith("/api");
    const isApiAuth = pathname.startsWith("/api/auth");

    if (!user) {
      if (isApi && !isApiAuth) {
        return NextResponse.json(apiError("Sessão expirada. Entre novamente."), { status: 401 });
      }
      if (!isPublic && !isApi) {
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("redirect", pathname);
        return NextResponse.redirect(loginUrl);
      }
      return response;
    }

    if (isApiAuth) return response;

    const acesso = acessoDeMetadata(user.app_metadata);
    const inicio = rotaInicial(acesso);

    if (isApi) {
      if (acesso.trocarSenha || !podeAcessarRota(acesso, pathname, request.method)) {
        return NextResponse.json(apiError("Você não tem permissão para esta operação."), { status: 403 });
      }
      return response;
    }

    // Conta desativada, ou ativa mas sem nenhum módulo liberado.
    if (!inicio) {
      return pathname === ROTA_SEM_ACESSO ? response : NextResponse.redirect(new URL(ROTA_SEM_ACESSO, request.url));
    }

    // Senha provisória: nada abre antes de o usuário definir a própria senha.
    if (acesso.trocarSenha) {
      return pathname === ROTA_TROCAR_SENHA ? response : NextResponse.redirect(new URL(ROTA_TROCAR_SENHA, request.url));
    }

    if (pathname === "/login" || pathname === "/" || pathname === ROTA_SEM_ACESSO) {
      return NextResponse.redirect(new URL(inicio, request.url));
    }

    if (!podeAcessarRota(acesso, pathname, request.method)) {
      return NextResponse.redirect(new URL(inicio, request.url));
    }
  } catch (error) {
    console.error("[middleware] falha ao verificar sessão Supabase:", error);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
