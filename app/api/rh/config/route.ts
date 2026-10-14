import { corpo, responder, sessao } from "@/lib/api";
import { createRhContext } from "@/lib/contexts/rh";

// Listas do RH (migração 052): tipos de documento de funcionário e
// documentos obrigatórios da empresa. Fica em /api/rh (módulo RH) e não em
// /api/config-empresa, que é do módulo Orçamento.

export async function GET() {
  const { supabase } = await sessao();
  return responder("carregar as configurações do RH", () => createRhContext(supabase).obterConfigRh());
}

export async function PUT(request: Request) {
  const { supabase } = await sessao();
  const dados = await corpo(request);
  return responder("salvar as configurações do RH", async () => {
    const ctx = createRhContext(supabase);
    await ctx.salvarConfigRh(dados);
    return ctx.obterConfigRh();
  });
}
