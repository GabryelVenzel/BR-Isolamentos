import { NextResponse } from "next/server";
import { createComercialContext } from "@/lib/contexts/comercial";
import { createFinanceiroContext } from "@/lib/contexts/financeiro";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { apiError, apiSuccess } from "@/lib/types/common";
import { logger } from "@/lib/logger";

// Sempre executada na hora — nunca servir resposta em cache.
export const dynamic = "force-dynamic";

/** Rotina diária (agendada em vercel.json): faz sozinha o que antes só
 * acontecia quando alguém abria a tela correspondente —
 *
 *   - reativa leads frios cujo prazo de retorno venceu;
 *   - gera os custos fixos do mês como lançamentos a pagar.
 *
 * Não há usuário logado: roda com a chave de serviço, e por isso exige o
 * segredo `CRON_SECRET` — a Vercel envia `Authorization: Bearer <segredo>`
 * automaticamente nas chamadas agendadas quando essa variável existe. Sem a
 * variável configurada a rota se recusa a rodar (nunca fica aberta).
 *
 * Os alertas do sino NÃO dependem desta rotina: são calculados na hora, a
 * cada consulta. As duas etapas são independentes — uma falhar não impede a
 * outra — e as telas continuam rodando as mesmas rotinas ao abrir. */
export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) {
    return NextResponse.json(apiError("CRON_SECRET não configurado no servidor."), { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${segredo}`) {
    return NextResponse.json(apiError("Não autorizado."), { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const resultado: Record<string, string | number> = {};

  try {
    resultado.leadsReativados = await createComercialContext(admin).verificarReativacoesPendentes();
  } catch (error) {
    logger.error("Rotina diária: falha ao reativar leads frios", error);
    resultado.leadsReativados = "erro";
  }

  try {
    const custosFixos = await createFinanceiroContext(admin).listarCustosFixosComHistoricoAtualizado();
    resultado.custosFixosConferidos = custosFixos.length;
  } catch (error) {
    logger.error("Rotina diária: falha ao gerar custos fixos do mês", error);
    resultado.custosFixosConferidos = "erro";
  }

  logger.info("Rotina diária concluída", resultado);
  return NextResponse.json(apiSuccess(resultado));
}
