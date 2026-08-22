// Contexto de negócio do módulo Operacional (parceiros de instalação + agenda
// de execução). Ponto único de import para telas e API routes — reúne os
// repositórios (`parceiros`, `agendamentos`) e os use cases de
// `lib/usecases/operacional` atrás de uma fachada injetada com o client do
// Supabase da requisição atual. Mesmo padrão de `lib/contexts/orcamento.ts`.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AgendamentoRepository,
  OrcamentoRepository,
  ParceiroRepository,
  type FiltrosAgendamento,
  type FiltrosParceiro,
} from "../repositories";
import type { Agendamento, Parceiro } from "../types/domain";
import { atualizarAgendamento, atualizarParceiro, criarAgendamento, criarParceiro } from "../usecases/operacional";

export function createOperacionalContext(supabase: SupabaseClient) {
  const parceiroRepo = new ParceiroRepository(supabase);
  const agendamentoRepo = new AgendamentoRepository(supabase);
  const orcamentoRepo = new OrcamentoRepository(supabase);

  return {
    parceiroRepo,
    agendamentoRepo,

    listarParceiros(filtros?: FiltrosParceiro): Promise<Parceiro[]> {
      return parceiroRepo.listar(filtros);
    },

    buscarParceiro(id: string): Promise<Parceiro> {
      return parceiroRepo.findByIdOrThrow(id);
    },

    criarParceiro(dados: unknown): Promise<Parceiro> {
      return criarParceiro(dados, { parceiroRepo });
    },

    atualizarParceiro(id: string, dados: unknown): Promise<Parceiro> {
      return atualizarParceiro(id, dados, { parceiroRepo });
    },

    removerParceiro(id: string): Promise<void> {
      return parceiroRepo.delete(id);
    },

    listarAgenda(filtros?: FiltrosAgendamento): Promise<Agendamento[]> {
      return agendamentoRepo.listar(filtros);
    },

    buscarAgendamento(id: string): Promise<Agendamento> {
      return agendamentoRepo.findByIdOrThrow(id);
    },

    criarAgendamento(dados: unknown): Promise<Agendamento> {
      return criarAgendamento(dados, { agendamentoRepo, orcamentoRepo, parceiroRepo });
    },

    atualizarAgendamento(id: string, dados: unknown): Promise<Agendamento> {
      return atualizarAgendamento(id, dados, { agendamentoRepo });
    },

    removerAgendamento(id: string): Promise<void> {
      return agendamentoRepo.delete(id);
    },
  };
}

export type OperacionalContext = ReturnType<typeof createOperacionalContext>;
