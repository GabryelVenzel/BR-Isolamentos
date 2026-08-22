// Contexto de negócio do módulo Comercial (CRM / funil de leads) — SCAFFOLDING.
//
// Este módulo ainda não tem tabela `leads` em `sql-schema.sql` nem tela no
// app. As funções abaixo já declaram a assinatura esperada (baseada no
// funil: prospecção → contato → proposta → negociação → fechado) para que,
// quando a tabela for criada, a implementação real seja um "preencher os
// buracos" em vez de desenhar a API do zero. Até lá, todas lançam
// `NotImplementedError` (HTTP 501) — nunca falhar silenciosamente.
//
// Passos para tirar este módulo do scaffolding:
//   1. Criar a migration da tabela `leads` (ver `Lead` em `lib/types/domain.ts`).
//   2. Criar `lib/repositories/lead.repository.ts` (extends BaseRepository<Lead>).
//   3. Implementar as funções abaixo usando o repositório, seguindo o padrão
//      de `lib/contexts/orcamento.ts`.
//   4. Criar `lib/validators/lead.ts` → já existe, revisar antes de usar.

import { NotImplementedError } from "../errors";
import type { EtapaFunil, Lead } from "../types/domain";

const AVISO = "Módulo Comercial (funil de leads) ainda não implementado — tabela `leads` pendente.";

/** Transições de etapa permitidas no funil — regra de negócio já decidida,
 * pronta para o use case `moverLead` quando o módulo for implementado. */
export const TRANSICOES_FUNIL: Record<EtapaFunil, EtapaFunil[]> = {
  prospeccao: ["contato"],
  contato: ["prospeccao", "proposta"],
  proposta: ["contato", "negociacao"],
  negociacao: ["proposta", "fechado"],
  fechado: [],
};

export interface CreateLeadInput {
  cliente_id: number;
  etapa: EtapaFunil;
  temperatura: Lead["temperatura"];
  valor_estimado: number;
  proxima_acao?: string | null;
  data_proxima_acao?: string | null;
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
