// Contexto de negócio do módulo Operacional (parceiros de instalação + agenda)
// — SCAFFOLDING. Mesma situação de `lib/contexts/comercial.ts`: tabelas
// `parceiros`/`agendamentos` ainda não existem. Ver `Parceiro`/`Agendamento`
// em `lib/types/domain.ts` para o formato de dado já definido.

import { NotImplementedError } from "../errors";
import type { Agendamento, Parceiro } from "../types/domain";

const AVISO = "Módulo Operacional (parceiros/agenda) ainda não implementado — tabelas pendentes.";

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

    async listarAgendaPorParceiro(_parceiroId: string): Promise<Agendamento[]> {
      throw new NotImplementedError(AVISO);
    },
  };
}

export type OperacionalContext = ReturnType<typeof createOperacionalContext>;
