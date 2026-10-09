// Cliente com a chave de SERVIÇO — ignora as regras de acesso do banco e
// consegue administrar contas de login (criar usuário, trocar senha, gravar
// app_metadata). Só pode ser importado por código de servidor (rotas de API);
// a chave nunca tem prefixo NEXT_PUBLIC_, então não vai pro navegador.
//
// Uso restrito à gestão de usuários (app/api/rh/usuarios, app/api/auth/senha).
// Dados de negócio continuam passando pelo cliente da sessão
// (lib/supabase/server.ts), pra valer a regra de acesso e a auditoria com o
// e-mail de quem fez a alteração.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ConfigurationError } from "../errors";
import { SUPABASE_URL } from "./env";

export function createSupabaseAdminClient(): SupabaseClient {
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!chave) {
    throw new ConfigurationError(
      "Variável SUPABASE_SERVICE_ROLE_KEY não configurada no servidor — necessária para gerenciar usuários."
    );
  }
  return createClient(SUPABASE_URL(), chave, { auth: { autoRefreshToken: false, persistSession: false } });
}
