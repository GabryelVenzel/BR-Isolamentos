import { acessoDeMetadata, podeAcessarModulo } from "@/lib/acesso";
import { corpo, responder, sessao } from "@/lib/api";
import { createComprasContext } from "@/lib/contexts/compras";
import { ForbiddenError } from "@/lib/errors";

/** GET: histórico de preços por item (pedidos enviados e recebidos) + o
 * catálogo de preços do orçamento, pra ligar itens de compra a ele. */
export async function GET() {
  const { supabase } = await sessao();
  return responder("carregar histórico de preços", async () => {
    const ctx = createComprasContext(supabase);
    const [historico, catalogo] = await Promise.all([ctx.historicoDePrecos(), ctx.listarCatalogo()]);
    return { historico, catalogo };
  });
}

/** POST { preco_config_id, preco_unitario }: leva um preço de compra para o
 * catálogo usado nos orçamentos — o catálogo é do módulo Orçamento, então
 * exige esse módulo (ou administrador), não só o Operacional. */
export async function POST(request: Request) {
  const { supabase, appMetadata } = await sessao();
  const dados = await corpo(request);
  return responder("aplicar preço ao catálogo", async () => {
    if (!podeAcessarModulo(acessoDeMetadata(appMetadata), "orcamento")) {
      throw new ForbiddenError("Só quem tem o módulo Orçamento pode alterar o catálogo de preços.");
    }
    await createComprasContext(supabase).aplicarPrecoAoCatalogo(dados);
    return { ok: true };
  });
}
