import { corpo, responder, sessao } from "@/lib/api";
import { hojeBrasilia } from "@/lib/financeiro";
import { ProjecaoFinanceiraRepository } from "@/lib/repositories";
import { CreateProjecaoSchema, parseOrThrow } from "@/lib/validators";

/** GET: projeções vigentes (vencimento hoje ou depois), por vencimento. */
export async function GET() {
  const { supabase } = await sessao();
  return responder("listar as projeções", () => new ProjecaoFinanceiraRepository(supabase).listarVigentes(hojeBrasilia()));
}

/** POST: nova projeção. */
export async function POST(request: Request) {
  const { supabase, email } = await sessao();
  const dados = await corpo(request);
  return responder(
    "criar a projeção",
    async () => new ProjecaoFinanceiraRepository(supabase).create({ ...parseOrThrow(CreateProjecaoSchema, dados), criado_por: email }),
    201
  );
}
