// Apelidos de login → email real cadastrado no Supabase Auth. Hardcoded (em vez de
// consultar a tabela `usuarios` no banco) de propósito: a consulta ocorre ANTES da
// autenticação, então precisaria de uma policy de RLS liberando leitura anônima da
// tabela de usuários — o que exporia todos os emails cadastrados publicamente. Como
// hoje só existe 1 login, um mapa fixo resolve sem abrir mão de segurança. Se no
// futuro isso crescer para vários usuários, vale revisar para uma solução via RPC
// com SECURITY DEFINER em vez de RLS pública.
const APELIDOS_LOGIN: Record<string, string> = {
  "BR-ISOLAMENTO": "gabryelvenzel@gmail.com",
};

/** Resolve um "usuário" (apelido de login) ou email direto para o email real usado no
 * Supabase Auth. Se não houver apelido cadastrado, assume que já é um email. */
export function resolverEmailDeLogin(identificador: string): string {
  return APELIDOS_LOGIN[identificador.trim().toUpperCase()] ?? identificador;
}
