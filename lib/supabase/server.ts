// Cliente para uso em Server Components e Route Handlers. Depende de
// next/headers — nunca importar a partir de um Client Component.

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

export function createSupabaseServerClient() {
  const cookieStore = cookies();

  return createServerClient(SUPABASE_URL(), SUPABASE_ANON_KEY(), {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch {
          // chamado a partir de um Server Component (sem permissão de escrita);
          // o middleware é responsável por renovar a sessão nesse caso.
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: "", ...options });
        } catch {
          // idem acima
        }
      },
    },
  });
}
