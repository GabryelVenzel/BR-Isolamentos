import { responder, sessao } from "@/lib/api";
import { createComprasContext } from "@/lib/contexts/compras";
import { ValidationError } from "@/lib/errors";

/** GET ?servico_id=&multiplicador=: materiais quantificados do orçamento da
 * obra, somados — ponto de partida de um pedido ou de uma cotação. */
export async function GET(request: Request) {
  const { supabase } = await sessao();
  const { searchParams } = new URL(request.url);
  return responder("montar a lista de compras da obra", async () => {
    const servicoId = searchParams.get("servico_id");
    if (!servicoId) throw new ValidationError("Informe a obra.");
    return createComprasContext(supabase).listaDeComprasDaObra(servicoId, Number(searchParams.get("multiplicador") ?? "1"));
  });
}
