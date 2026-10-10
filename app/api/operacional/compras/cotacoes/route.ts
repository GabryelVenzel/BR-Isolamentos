import { corpo, responder, sessao } from "@/lib/api";
import { createComprasContext } from "@/lib/contexts/compras";

/** GET: cotações, com as propostas de cada fornecedor. */
export async function GET() {
  const { supabase } = await sessao();
  return responder("listar cotações", () => createComprasContext(supabase).listarCotacoes());
}

/** POST: cria uma cotação. */
export async function POST(request: Request) {
  const { supabase, email } = await sessao();
  const dados = await corpo(request);
  return responder("criar cotação", () => createComprasContext(supabase).criarCotacao(dados, email), 201);
}
