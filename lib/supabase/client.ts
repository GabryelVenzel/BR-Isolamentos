// Cliente para uso em Client Components ("use client"). Não importa
// next/headers — precisa poder ser incluído no bundle do browser.

import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

export function createSupabaseBrowserClient() {
  return createBrowserClient(SUPABASE_URL(), SUPABASE_ANON_KEY());
}
