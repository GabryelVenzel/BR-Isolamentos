// Contexto de negócio do módulo Comercial (CRM / funil de leads).
//
// Ponto único de import para telas e API routes que trabalham com leads —
// reúne os repositórios (`leads`, `interacoes_lead`) e os use cases de
// `lib/usecases/comercial` atrás de uma fachada injetada com o client do
// Supabase da requisição atual. Mesmo padrão de `lib/contexts/orcamento.ts`.

import type { SupabaseClient } from "@supabase/supabase-js";
import { InteracaoLeadRepository, LeadRepository, type FiltrosLead } from "../repositories";
import type { EtapaFunil, InteracaoLead, Lead } from "../types/domain";
import { atualizarLead, criarLead, moverLead, registrarInteracao, TRANSICOES_FUNIL } from "../usecases/comercial";

export { TRANSICOES_FUNIL };

export function createComercialContext(supabase: SupabaseClient) {
  const leadRepo = new LeadRepository(supabase);
  const interacaoRepo = new InteracaoLeadRepository(supabase);

  return {
    leadRepo,
    interacaoRepo,

    listarLeads(filtros?: FiltrosLead): Promise<Lead[]> {
      return leadRepo.listar(filtros);
    },

    buscarLead(id: string): Promise<Lead> {
      return leadRepo.findByIdOrThrow(id);
    },

    criarLead(dados: unknown): Promise<Lead> {
      return criarLead(dados, { leadRepo });
    },

    atualizarLead(id: string, dados: unknown): Promise<Lead> {
      return atualizarLead(id, dados, { leadRepo });
    },

    moverLead(leadId: string, novaEtapa: EtapaFunil): Promise<Lead> {
      return moverLead({ leadId, novaEtapa }, { leadRepo });
    },

    removerLead(id: string): Promise<void> {
      return leadRepo.delete(id);
    },

    listarInteracoes(leadId: string): Promise<InteracaoLead[]> {
      return interacaoRepo.listarPorLead(leadId);
    },

    registrarInteracao(dados: unknown): Promise<InteracaoLead> {
      return registrarInteracao(dados, { leadRepo, interacaoRepo });
    },
  };
}

export type ComercialContext = ReturnType<typeof createComercialContext>;
