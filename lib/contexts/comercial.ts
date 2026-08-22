// Contexto de negócio do módulo Comercial (CRM / funil de leads) — SCAFFOLDING.
//
// O SQL das tabelas `leads`/`interacoes_lead` já existe em
// sql-migration-004-6modulos-completo.sql (ver lib/types/domain.ts para os
// tipos correspondentes) — falta aplicar a migration no Supabase e
// implementar repositório/use cases. As funções abaixo já declaram a
// assinatura esperada (funil: prospecção → contato → proposta → negociação →
// fechado, com saída possível para "perdido" em qualquer etapa ativa) para
// que a implementação real seja um "preencher os buracos" em vez de desenhar
// a API do zero. Até lá, todas lançam `NotImplementedError` (HTTP 501) —
// nunca falhar silenciosamente.
//
// Passos para tirar este módulo do scaffolding:
//   1. Aplicar sql-migration-004-6modulos-completo.sql no Supabase SQL Editor.
//   2. Criar `lib/repositories/lead.repository.ts` (extends BaseRepository<Lead>).
//   3. Implementar as funções abaixo usando o repositório, seguindo o padrão
//      de `lib/contexts/orcamento.ts`.
//   4. Revisar `lib/validators/lead.ts` (já existe) antes de usar.

import { NotImplementedError } from "../errors";
import type { EtapaFunil, Lead } from "../types/domain";

const AVISO = "Módulo Comercial (funil de leads) ainda não implementado — aplique sql-migration-004-6modulos-completo.sql e implemente o repositório.";

/** Transições de etapa permitidas no funil — regra de negócio já decidida,
 * pronta para o use case `moverLead` quando o módulo for implementado.
 * "perdido" é terminal (igual "fechado") e pode ser alcançado a partir de
 * qualquer etapa ativa — desistência do cliente não segue uma ordem fixa. */
export const TRANSICOES_FUNIL: Record<EtapaFunil, EtapaFunil[]> = {
  prospeccao: ["contato", "perdido"],
  contato: ["prospeccao", "proposta", "perdido"],
  proposta: ["contato", "negociacao", "perdido"],
  negociacao: ["proposta", "fechado", "perdido"],
  fechado: [],
  perdido: [],
};

export interface CreateLeadInput {
  cliente_id: number;
  etapa: EtapaFunil;
  temperatura: Lead["temperatura"];
  valor_estimado: number;
  origem?: string | null;
  proxima_acao?: string | null;
  data_proxima_acao?: string | null;
  notas?: string | null;
  atribuido_a?: string | null;
  tags?: string[];
}

export function createComercialContext() {
  return {
    async criarLead(_dados: CreateLeadInput): Promise<Lead> {
      throw new NotImplementedError(AVISO);
    },

    async moverLead(_id: string, _novaEtapa: EtapaFunil): Promise<Lead> {
      throw new NotImplementedError(AVISO);
    },

    async listarLeadsPorEtapa(_etapa: EtapaFunil): Promise<Lead[]> {
      throw new NotImplementedError(AVISO);
    },
  };
}

export type ComercialContext = ReturnType<typeof createComercialContext>;
