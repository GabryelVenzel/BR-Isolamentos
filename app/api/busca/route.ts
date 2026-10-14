import { responder, sessao } from "@/lib/api";
import { createBuscaContext } from "@/lib/contexts/busca";

/** GET ?q=: busca geral do cabeçalho (revisão de usabilidade) — leads,
 * obras, orçamentos, clientes, parceiros, fornecedores e funcionários, cada
 * um só se o usuário puder ler (regras do banco). */
export async function GET(request: Request) {
  const { supabase } = await sessao();
  const q = new URL(request.url).searchParams.get("q") ?? "";
  return responder("buscar", () => createBuscaContext(supabase).buscar(q));
}
