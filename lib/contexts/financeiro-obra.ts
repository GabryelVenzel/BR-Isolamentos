// Financeiro ligado à obra (migração 041): resultado por obra, DRE e o
// lançamento de despesas a partir do detalhe do serviço. Fica num contexto
// próprio porque é consumido por três módulos — Operacional (a obra), Resumo
// (os relatórios) e Financeiro — e cada rota já chega aqui com o módulo
// conferido pelo middleware (ver lib/acesso.ts); o banco repete a regra
// (migração 039: quem tem Operacional só enxerga/cria lançamento com obra).

import type { SupabaseClient } from "@supabase/supabase-js";
import { CategoriaLancamentoRepository, LancamentoFinanceiroRepository, ServicoRepository } from "../repositories";
import type { CategoriaLancamento, LancamentoFinanceiro } from "../types/domain";
import {
  calcularDre,
  calcularResultadoObra,
  calcularResultadoPorObra,
  criarLancamento,
  type Dre,
  type ResultadoObra,
} from "../usecases/financeiro";

export interface FinanceiroDoServico {
  resultado: ResultadoObra;
  lancamentos: LancamentoFinanceiro[];
  /** Categorias de despesa ativas — pro formulário "Registrar despesa". */
  categoriasDespesa: CategoriaLancamento[];
}

export function createFinanceiroObraContext(supabase: SupabaseClient) {
  const lancamentoRepo = new LancamentoFinanceiroRepository(supabase);
  const servicoRepo = new ServicoRepository(supabase);
  const categoriaRepo = new CategoriaLancamentoRepository(supabase);

  return {
    async financeiroDoServico(servicoId: string): Promise<FinanceiroDoServico> {
      const [servico, lancamentos, categoriasDespesa] = await Promise.all([
        servicoRepo.findByIdOrThrow(servicoId),
        lancamentoRepo.listar({ servicoId }),
        categoriaRepo.listar({ tipo: "despesa", ativo: true }),
      ]);
      return { resultado: calcularResultadoObra(servico, lancamentos), lancamentos, categoriasDespesa };
    },

    /** Despesa lançada de dentro da obra: tipo e obra são fixados aqui, não
     * vêm do formulário. */
    async registrarDespesaDoServico(servicoId: string, dados: unknown): Promise<LancamentoFinanceiro> {
      await servicoRepo.findByIdOrThrow(servicoId);
      const corpo = typeof dados === "object" && dados !== null ? dados : {};
      return criarLancamento({ ...corpo, tipo: "despesa", servico_id: servicoId }, { lancamentoRepo });
    },

    async resultadoPorObra(): Promise<ResultadoObra[]> {
      const [servicos, lancamentos] = await Promise.all([servicoRepo.listar(), lancamentoRepo.listarLigadosAObras()]);
      return calcularResultadoPorObra(servicos, lancamentos);
    },

    /** O DRE sempre cobre MESES INTEIROS: o período do filtro é esticado do
     * primeiro dia do mês inicial ao último dia do mês final. Sem isso,
     * "mês atual" (que termina hoje) deixaria de fora o que já está lançado
     * com competência neste mês mas data mais adiante. */
    async dre(dataInicio: string, dataFim: string): Promise<Dre> {
      const inicio = `${dataInicio.slice(0, 7)}-01`;
      const [ano, mes] = dataFim.split("-").map(Number);
      const fim = `${dataFim.slice(0, 7)}-${String(new Date(Date.UTC(ano, mes, 0)).getUTCDate()).padStart(2, "0")}`;
      const lancamentos = await lancamentoRepo.listar({ dataInicio: inicio, dataFim: fim, porCompetencia: true });
      return calcularDre(lancamentos, inicio, fim);
    },
  };
}
