import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createOrcamentoContext } from "@/lib/contexts/orcamento";
import { toHttpError, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";

// Mantém o formato de resposta "cru" por compatibilidade com o frontend
// existente (app/historico, wizard) — ver `lib/CONVENTIONS.md`.

export async function GET(request: Request) {
  const supabase = createSupabaseServerClient();
  const ctx = createOrcamentoContext(supabase);
  const { searchParams } = new URL(request.url);

  try {
    const data = await ctx.listar({
      status: searchParams.get("status") ?? undefined,
      clienteId: searchParams.get("cliente_id") ?? undefined,
      dataInicio: searchParams.get("data_inicio") ?? undefined,
      dataFim: searchParams.get("data_fim") ?? undefined,
    });
    return NextResponse.json(data);
  } catch (error) {
    logger.error("Falha ao listar orçamentos", error);
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient();
  const ctx = createOrcamentoContext(supabase);
  const body = await request.json().catch(() => null);

  try {
    if (!body?.cliente_id) throw new ValidationError("Orçamento sem cliente vinculado.");
    if (!Array.isArray(body.itens) || body.itens.length === 0) {
      throw new ValidationError("Orçamento precisa de ao menos um item/trecho.");
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const orcamento = await ctx.criar(body, user?.email ?? null);

    logger.info("Orçamento criado", { id: orcamento.id, numero: orcamento.numero });
    return NextResponse.json(orcamento, { status: 201 });
  } catch (error) {
    logger.error("Falha ao criar orçamento", error);
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
