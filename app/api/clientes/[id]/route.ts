import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ClienteRepository } from "@/lib/repositories";
import { UpdateClienteSchema, parseOrThrow } from "@/lib/validators";
import { ConflictError, toHttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";

interface Params {
  params: { id: string };
}

// Estende a rota legada `/api/clientes` (não cria uma família paralela
// `/api/comercial/clientes`) — a aba "Clientes" do CRM é só mais um
// consumidor da mesma tabela/repositório já usado pelo wizard de orçamento.
// Mesmo formato de resposta "cru" do arquivo irmão (`route.ts`).

export async function GET(_request: Request, { params }: Params) {
  const supabase = createSupabaseServerClient();
  const clienteRepo = new ClienteRepository(supabase);

  try {
    const cliente = await clienteRepo.findByIdOrThrow(Number(params.id));
    return NextResponse.json(cliente);
  } catch (error) {
    logger.error("Falha ao buscar cliente", error, { id: params.id });
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

export async function PATCH(request: Request, { params }: Params) {
  const supabase = createSupabaseServerClient();
  const clienteRepo = new ClienteRepository(supabase);
  const body = await request.json().catch(() => null);

  try {
    const dados = parseOrThrow(UpdateClienteSchema, body);
    const cliente = await clienteRepo.update(Number(params.id), dados);
    logger.info("Cliente atualizado", { id: params.id });
    return NextResponse.json(cliente);
  } catch (error) {
    logger.error("Falha ao atualizar cliente", error, { id: params.id });
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

/** DELETE: bloqueia a exclusão se o cliente tiver algum lead OU orçamento
 * associado (regra do pedido: "não deleta se houver leads"; estendida aqui
 * pra orçamento — um cliente pode ter orçamento sem nunca ter passado por
 * um Lead, criado direto pelo wizard) — o usuário precisa excluir/realocar
 * esses registros primeiro. */
export async function DELETE(_request: Request, { params }: Params) {
  const supabase = createSupabaseServerClient();
  const clienteRepo = new ClienteRepository(supabase);

  try {
    const clienteId = Number(params.id);
    const totalLeads = await clienteRepo.contarLeads(clienteId);
    if (totalLeads > 0) {
      throw new ConflictError(
        `Este cliente tem ${totalLeads} lead${totalLeads === 1 ? "" : "s"} associado${totalLeads === 1 ? "" : "s"} — exclua ou realoque ${totalLeads === 1 ? "o lead" : "os leads"} antes de excluir o cliente.`
      );
    }

    const totalOrcamentos = await clienteRepo.contarOrcamentos(clienteId);
    if (totalOrcamentos > 0) {
      throw new ConflictError(
        `Este cliente tem ${totalOrcamentos} orçamento${totalOrcamentos === 1 ? "" : "s"} associado${totalOrcamentos === 1 ? "" : "s"} — não é possível excluir um cliente com histórico de orçamento.`
      );
    }

    // Qualquer OUTRA referência de chave estrangeira a este cliente que não
    // seja lead/orçamento (ex.: uma tabela futura) já vira uma mensagem
    // amigável genérica — `toHttpError` reconhece o código 23503 (violação
    // de chave estrangeira) pra qualquer rota, não só esta (ver lib/errors.ts).
    await clienteRepo.delete(clienteId);

    logger.info("Cliente excluído", { id: params.id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error("Falha ao excluir cliente", error, { id: params.id });
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
