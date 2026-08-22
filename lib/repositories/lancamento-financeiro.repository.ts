import type { SupabaseClient } from "@supabase/supabase-js";
import type { LancamentoFinanceiro, TipoLancamentoFinanceiro } from "../types/domain";
import { BaseRepository } from "./base";

export interface FiltrosLancamento {
  tipo?: TipoLancamentoFinanceiro | string;
  categoria?: string;
  pago?: boolean;
  dataInicio?: string;
  dataFim?: string;
}

export interface ResumoMesAtual {
  mes: string;
  receita_total: number;
  despesa_total: number;
  lucro_bruto: number;
  numero_orcamentos: number;
}

export class LancamentoFinanceiroRepository extends BaseRepository<LancamentoFinanceiro> {
  protected select = "*, orcamento:orcamentos(*, cliente:clientes(*))";

  constructor(supabase: SupabaseClient) {
    super(supabase, "lancamentos_financeiros");
  }

  async listar(filtros: FiltrosLancamento = {}): Promise<LancamentoFinanceiro[]> {
    let query = this.queryBuilder().select(this.select).order("data", { ascending: false });

    if (filtros.tipo) query = query.eq("tipo", filtros.tipo);
    if (filtros.categoria) query = query.eq("categoria", filtros.categoria);
    if (filtros.pago !== undefined) query = query.eq("pago", filtros.pago);
    if (filtros.dataInicio) query = query.gte("data", filtros.dataInicio);
    if (filtros.dataFim) query = query.lte("data", filtros.dataFim);

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as unknown as LancamentoFinanceiro[];
  }

  /** Lê a view `v_financeiro_mes_atual` (ver sql-migration-004-6modulos-completo.sql). */
  async resumoMesAtual(): Promise<ResumoMesAtual> {
    const { data, error } = await this.supabase.from("v_financeiro_mes_atual").select("*").maybeSingle();
    if (error) throw error;
    return (
      (data as unknown as ResumoMesAtual) ?? {
        mes: new Date().toISOString().slice(0, 7),
        receita_total: 0,
        despesa_total: 0,
        lucro_bruto: 0,
        numero_orcamentos: 0,
      }
    );
  }

  // --- Consultas do dashboard executivo (módulo Resumo) ---
  //
  // `tipoTrabalho`/`responsavel` são atributos do ORÇAMENTO, não do
  // lançamento — filtrar por eles exige juntar com `orcamentos`. Quando um
  // desses filtros está ativo, o join vira `!inner` (só lançamentos COM
  // orçamento vinculado entram no resultado); sem filtro, fica `left join`
  // (lançamentos sem orçamento — ex. "aluguel" — continuam contando).
  private selectParaFiltro(opts: FiltroCruzado): string {
    return opts.tipoTrabalho || opts.responsavel
      ? "valor, orcamento:orcamentos!inner(tipo_trabalho, atribuido_a)"
      : "valor";
  }

  private aplicarFiltroCruzado<T extends { eq: (col: string, val: unknown) => T }>(query: T, opts: FiltroCruzado): T {
    let q = query;
    if (opts.tipoTrabalho) q = q.eq("orcamento.tipo_trabalho", opts.tipoTrabalho);
    if (opts.responsavel) q = q.eq("orcamento.atribuido_a", opts.responsavel);
    return q;
  }

  /** Soma `valor` de lançamentos de um `tipo` ('receita'/'despesa') num
   * intervalo de datas, com os filtros cruzados opcionais de tipo de
   * trabalho/responsável (ver nota acima). */
  async somarPorTipo(
    tipo: TipoLancamentoFinanceiro,
    dataInicio: string,
    dataFim: string,
    opts: FiltroCruzado = {}
  ): Promise<number> {
    let query = this.queryBuilder()
      .select(this.selectParaFiltro(opts))
      .eq("tipo", tipo)
      .gte("data", dataInicio)
      .lte("data", dataFim);
    query = this.aplicarFiltroCruzado(query, opts);

    const { data, error } = await query;
    if (error) throw error;
    return ((data ?? []) as Array<{ valor: number }>).reduce((acc, l) => acc + l.valor, 0);
  }

  /** Linhas cruas de um `tipo` num intervalo — usado pra agrupar por mês em
   * memória (lib/usecases/resumo/receitaVsDespesa.ts), já que agrupar por
   * mês arbitrário não dá pra expressar com o query builder do supabase-js
   * sem uma função SQL dedicada. */
  async listarValoresPorTipo(
    tipo: TipoLancamentoFinanceiro,
    dataInicio: string,
    dataFim: string,
    opts: FiltroCruzado = {}
  ): Promise<Array<{ data: string; valor: number }>> {
    let query = this.queryBuilder()
      .select(opts.tipoTrabalho || opts.responsavel ? "data, valor, orcamento:orcamentos!inner(tipo_trabalho, atribuido_a)" : "data, valor")
      .eq("tipo", tipo)
      .gte("data", dataInicio)
      .lte("data", dataFim);
    query = this.aplicarFiltroCruzado(query, opts);

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as Array<{ data: string; valor: number }>;
  }

  /** Contas a receber em aberto (`pago = false`). "Vencidas" usa a coluna
   * `data` do lançamento como proxy da data de vencimento — a tabela não tem
   * uma coluna `data_vencimento` separada (diferente de `notas_fiscais`, que
   * tem); pra receitas, `data` já é preenchida como a data esperada do
   * recebimento, então é a melhor aproximação disponível sem migration nova. */
  async listarAReceber(): Promise<LancamentoFinanceiro[]> {
    const { data, error } = await this.queryBuilder()
      .select(this.select)
      .eq("tipo", "receita")
      .eq("pago", false);
    if (error) throw error;
    return (data ?? []) as unknown as LancamentoFinanceiro[];
  }
}

interface FiltroCruzado {
  tipoTrabalho?: string;
  responsavel?: string;
}
