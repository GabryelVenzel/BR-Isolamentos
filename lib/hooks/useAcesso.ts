"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { acessoDeMetadata, type Acesso } from "@/lib/acesso";

export interface AcessoAtual {
  /** `null` enquanto carrega ou sem sessão. */
  acesso: Acesso | null;
  email: string | null;
}

/** Acesso do usuário logado, lido do `app_metadata` da sessão — só pra
 * decidir o que MOSTRAR (itens de menu, abas). Quem de fato bloqueia é o
 * middleware e o banco; esconder um link aqui não é a proteção. */
export function useAcesso(): AcessoAtual {
  const [estado, setEstado] = useState<AcessoAtual>({ acesso: null, email: null });

  useEffect(() => {
    let supabase: ReturnType<typeof createSupabaseBrowserClient>;
    try {
      supabase = createSupabaseBrowserClient();
    } catch {
      return;
    }

    // `getUser()` (e não a sessão em cache) pra refletir uma mudança de
    // permissão feita pelo administrador sem exigir novo login.
    supabase.auth
      .getUser()
      .then(({ data }) =>
        setEstado({ acesso: data.user ? acessoDeMetadata(data.user.app_metadata) : null, email: data.user?.email ?? null })
      )
      .catch(() => undefined);

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setEstado({
        acesso: session?.user ? acessoDeMetadata(session.user.app_metadata) : null,
        email: session?.user?.email ?? null,
      });
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  return estado;
}
