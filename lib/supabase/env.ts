/**
 * Recebe o VALOR já resolvido (não o nome) — importante. `process.env[nome]`
 * (acesso dinâmico via colchetes) não pode ser inlinado pelo Next.js: a
 * substituição de `NEXT_PUBLIC_*` por seu valor real acontece em build time
 * procurando literalmente `process.env.NEXT_PUBLIC_X` (acesso estático, com
 * ponto) no código-fonte. Com colchetes e uma variável, o Next.js não sabe o
 * nome em build time e não substitui nada — no navegador `process` nem
 * existe de verdade, então a leitura sempre dá `undefined`, não importa o
 * que esteja configurado na Vercel. Foi exatamente esse bug que fazia todo
 * upload de anexo falhar silenciosamente em produção (SUPABASE_URL/
 * SUPABASE_ANON_KEY abaixo precisam manter `process.env.NEXT_PUBLIC_...`
 * escrito por extenso, nunca via `requireEnv(nomeDinamico)`).
 */
export function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Variável de ambiente ${name} não configurada. Preencha .env.local (veja .env.example).`
    );
  }
  return value;
}

export const SUPABASE_URL = () => requireEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
export const SUPABASE_ANON_KEY = () =>
  requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
