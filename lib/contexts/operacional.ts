// Contexto de negócio do módulo Operacional (parceiros de instalação + agenda)
// — SCAFFOLDING. Mesma situação de `lib/contexts/comercial.ts`: o SQL das
// tabelas `parceiros`/`agendamentos` já existe em
// sql-migration-004-6modulos-completo.sql, falta aplicar no Supabase e
// implementar repositório/use cases. Ver `Parceiro`/`Agendamento` em
// `lib/types/domain.ts` para o formato de dado já definido — note que
// `Agendamento.parceiros_alocados` é uma lista de ids (um agendamento pode ter
// mais de um parceiro), não um `parceiro_id` único.

import { NotImplementedError } from "../errors";
import type { Agendamento, Parceiro } from "../types/domain";

const AVISO = "Módulo Operacional (parceiros/agenda) ainda não implementado — aplique sql-migration-004-6modulos-completo.sql e implemente o repositório.";

export function createOperacionalContext() {
  return {
    async listarParceiros(): Promise<Parceiro[]> {
      throw new NotImplementedError(AVISO);
    },

    async agendarInstalacao(
      _dados: Omit<Agendamento, "id" | "created_at" | "updated_at" | "status">
    ): Promise<Agendamento> {
      throw new NotImplementedError(AVISO);
    },

    /** Agendamentos onde `parceiroId` está entre os alocados (ver nota acima
     * sobre `parceiros_alocados` ser uma lista). */
    async listarAgendaPorParceiro(_parceiroId: string): Promise<Agendamento[]> {
      throw new NotImplementedError(AVISO);
    },
  };
}

export type OperacionalContext = ReturnType<typeof createOperacionalContext>;
