export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Variável de ambiente ${name} não configurada. Preencha .env.local (veja .env.example).`
    );
  }
  return value;
}

export const SUPABASE_URL = () => requireEnv("NEXT_PUBLIC_SUPABASE_URL");
export const SUPABASE_ANON_KEY = () => requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
