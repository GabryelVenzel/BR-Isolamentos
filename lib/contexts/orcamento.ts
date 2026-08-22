// Contexto de negócio do módulo Orçamento: ponto único de import para telas e
// API routes que trabalham com orçamentos — reúne o repositório e os use
// cases já existentes (`lib/usecases/orcamento`) atrás de uma fachada
// injetada com o client do Supabase da requisição atual.
//
// Uso típico numa API route:
//
//   import { createOrcamentoContext } from "@/lib/contexts/orcamento";
//   const ctx = createOrcamentoContext(createSupabaseServerClient());
//   const orcamentos = await ctx.listar({ status: "aceito" });

import type { SupabaseClient } from "@supabase/supabase-js";
import { OrcamentoRepository, type FiltrosOrcamento } from "../repositories";
import type { ItemOrcamento, Orcamento } from "../types";
import { atualizarOrcamento, calcularOrcamento, criarOrcamento } from "../usecases/orcamento";
import type { CalcularOrcamentoInput, CalcularOrcamentoResultado } from "../types";

export function createOrcamentoContext(supabase: SupabaseClient) {
  const orcamentoRepo = new OrcamentoRepository(supabase);

  return {
    repo: orcamentoRepo,

    listar(filtros?: FiltrosOrcamento): Promise<Orcamento[]> {
      return orcamentoRepo.listar(filtros);
    },

    buscarPorId(id: number | string): Promise<Orcamento> {
      return orcamentoRepo.findByIdOrThrow(id);
    },

    criar(
      cabecalho: Partial<Orcamento> & { cliente_id: number; itens: Array<Partial<ItemOrcamento>> },
      criadoPor: string | null
    ): Promise<Orcamento> {
      return criarOrcamento({ cabecalho, criadoPor }, { orcamentoRepo });
    },

    atualizar(id: number | string, dados: Partial<Orcamento>): Promise<Orcamento> {
      return atualizarOrcamento(id, dados, { orcamentoRepo });
    },

    remover(id: number | string): Promise<void> {
      return orcamentoRepo.delete(id);
    },

    /** Cálculo financeiro puro — não depende do Supabase, não persiste nada. */
    calcular(input: CalcularOrcamentoInput): CalcularOrcamentoResultado {
      return calcularOrcamento(input);
    },
  };
}

export type OrcamentoContext = ReturnType<typeof createOrcamentoContext>;
