import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseMiddlewareClient } from "@/lib/supabase/middleware";

const PUBLIC_PATHS = ["/login"];

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request: { headers: request.headers } });

  // A checagem de sessão aqui é "best effort": se o Supabase (ou as env vars)
  // estiverem indisponíveis, deixamos a requisição passar em vez de derrubar
  // o site inteiro com um 500 (MIDDLEWARE_INVOCATION_FAILED). A página em si
  // (Server Component) é quem decide de fato o que renderizar sem sessão.
  try {
    const supabase = createSupabaseMiddlewareClient(request, response);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { pathname } = request.nextUrl;
    const isPublic = PUBLIC_PATHS.some((path) => pathname.startsWith(path));
    const isApi = pathname.startsWith("/api");

    if (!user && !isPublic && !isApi) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (user && pathname === "/login") {
      return NextResponse.redirect(new URL("/resumo", request.url));
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
