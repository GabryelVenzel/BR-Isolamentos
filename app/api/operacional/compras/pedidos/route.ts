import { corpo, responder, sessao } from "@/lib/api";
import { createComprasContext } from "@/lib/contexts/compras";

/** GET: pedidos de compra (filtros: status, fornecedor_id, servico_id). */
export async function GET(request: Request) {
  const { supabase } = await sessao();
  const { searchParams } = new URL(request.url);
  return responder("listar pedidos de compra", () =>
    createComprasContext(supabase).listarPedidos({
      status: searchParams.get("status") ?? undefined,
      fornecedorId: searchParams.get("fornecedor_id") ?? undefined,
      servicoId: searchParams.get("servico_id") ?? undefined,
    })
  );
}

/** POST: cria um pedido de compra em rascunho. */
export async function POST(request: Request) {
  const { supabase, email } = await sessao();
  const dados = await corpo(request);
  return responder("criar pedido de compra", () => createComprasContext(supabase).criarPedido(dados, email), 201);
}
