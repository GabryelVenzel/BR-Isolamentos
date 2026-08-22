import { logger } from "../../logger";
import type { AgendamentoLeadFrioRepository, HistoricoMudancaLeadRepository, LeadRepository } from "../../repositories";
import { reativarLeadFrio } from "./reativarLeadFrio";

/** "Automação" de reativação de leads frios — na ausência de um cron real no
 * projeto (Vercel Cron exigiria plano pago + um `vercel.json` novo, fora do
 * escopo deste pedido), este sweep roda SOB DEMANDA: é chamado no início de
 * GET /api/comercial/leads e GET /api/comercial/leads-frios, então qualquer
 * agendamento vencido é reativado assim que alguém abre o CRM depois do
 * prazo — equivalente na prática para uma ferramenta usada em horário
 * comercial, mesmo sem um processo rodando em segundo plano.
 *
 * Cada reativação é isolada em try/catch: uma falha (ex.: lead já deletado)
 * não pode travar a listagem inteira nem impedir a reativação dos outros
 * agendamentos vencidos. */
export async function verificarReativacoesPendentes(repos: {
  leadRepo: LeadRepository;
  historicoRepo: HistoricoMudancaLeadRepository;
  agendamentoFrioRepo: AgendamentoLeadFrioRepository;
}): Promise<number> {
  const vencidos = await repos.agendamentoFrioRepo.listarVencidos(new Date().toISOString());

  let reativados = 0;
  for (const agendamento of vencidos) {
    try {
      await reativarLeadFrio(agendamento.id, repos, "sistema@automatico", false);
      reativados++;
    } catch (error) {
      logger.error("Falha ao reativar lead frio automaticamente", error, { agendamentoId: agendamento.id });
    }
  }

  return reativados;
}
