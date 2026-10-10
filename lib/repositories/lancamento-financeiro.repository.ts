import type { SupabaseClient } from "@supabase/supabase-js";
import type { LancamentoFinanceiro, TipoLancamentoFinanceiro } from "../types/domain";
import { BaseRepository } from "./base";

export interface FiltrosLancamento {
  tipo?: TipoLancamentoFinanceiro | string;
  categoria?: string;
  pago?: boolean;
  dataInicio?: string;
  dataFim?: string;
  /** `dataInicio`/`dataFim` filtram pela COMPETÊNCIA em vez do vencimento —
   * usado pelos relatórios de resultado (migração 041). */
  porCompetencia?: boolean;
  formaPagamento?: string;
  servicoId?: string;
  fornecedorId?: string;
  parceiroId?: string;
}

export interface ResumoMesAtual {
  mes: string;
  receita_total: number;
  despesa_total: number;
  lucro_bruto: number;
  numero_orcamentos: number;
}

export class LancamentoFinanceiroRepository extends BaseRepository<LancamentoFinanceiro> {
  // Além do orçamento, traz o nome do que está ligado ao lançamento
  // (migração 041): obra, fornecedor e parceiro.
  protected select =
    "*, orcamento:orcamentos(*, cliente:clientes(*)), servico:servicos(id, numero_servico, cliente:clientes(nome)), fornecedor:fornecedores(id, nome), parceiro:parceiros(id, nome)";

  constructor(supabase: SupabaseClient) {
    super(supabase, "lancamentos_financeiros");
  }

  async listar(filtros: FiltrosLancamento = {}): Promise<LancamentoFinanceiro[]> {
    let query = this.queryBuilder().select(this.select).order("data", { ascending: false });

    if (filtros.tipo) query = query.eq("tipo", filtros.tipo);
    if (filtros.categoria) query = query.eq("categoria", filtros.categoria);
    if (filtros.pago !== undefined) query = query.eq("pago", filtros.pago);
    const colunaData = filtros.porCompetencia ? "data_competencia" : "data";
    if (filtros.dataInicio) query = query.gte(colunaData, filtros.dataInicio);
    if (filtros.dataFim) query = query.lte(colunaData, filtros.dataFim);
    if (filtros.formaPagamento) query = query.eq("forma_pagamento", filtros.formaPagamento);
    if (filtros.servicoId) query = query.eq("servico_id", filtros.servicoId);
    if (filtros.fornecedorId) query = query.eq("fornecedor_id", filtros.fornecedorId);
    if (filtros.parceiroId) query = query.eq("parceiro_id", filtros.parceiroId);

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as unknown as LancamentoFinanceiro[];
  }

  /** Cria vários lançamentos de uma vez (parcelas/recorrência — ver
   * lib/usecases/financeiro/criarLancamento.ts). Um único insert: ou entram
   * todos, ou nenhum. */
  async createMany(linhas: Array<Partial<LancamentoFinanceiro>>): Promise<LancamentoFinanceiro[]> {
    const { data, error } = await this.queryBuilder().insert(linhas).select(this.select).order("parcela_numero");
    if (error) throw error;
    return (data ?? []) as unknown as LancamentoFinanceiro[];
  }

  /** Exclui o lançamento informado e as parcelas SEGUINTES do mesmo grupo
   * que ainda estão em aberto — as que já foram pagas ficam (apagar um
   * pagamento registrado por tabela seria perder histórico). Devolve quantas
   * linhas foram excluídas no total. */
  async excluirDestaEmDiante(lancamento: Pick<LancamentoFinanceiro, "id" | "grupo_id" | "parcela_numero">): Promise<number> {
    await this.delete(lancamento.id);
    if (!lancamento.grupo_id || lancamento.parcela_numero == null) return 1;

    const { data, error } = await this.queryBuilder()
      .delete()
      .eq("grupo_id", lancamento.grupo_id)
      .gt("parcela_numero", lancamento.parcela_numero)
      .eq("pago", false)
      .select("id");
    if (error) throw error;
    return 1 + (data ?? []).length;
  }

  /** Só os campos que o resultado por obra precisa, de todos os lançamentos
   * ligados a alguma obra. */
  async listarLigadosAObras(): Promise<Array<Pick<LancamentoFinanceiro, "servico_id" | "tipo" | "valor" | "pago">>> {
    const { data, error } = await this.queryBuilder().select("servico_id, tipo, valor, pago").not("servico_id", "is", null);
    if (error) throw error;
    return (data ?? []) as Array<Pick<LancamentoFinanceiro, "servico_id" | "tipo" | "valor" | "pago">>;
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
   * trabalho/responsável (ver nota acima). O intervalo é pela COMPETÊNCIA
   * (a que mês o valor pertence), não pelo vencimento. */
  async somarPorTipo(
    tipo: TipoLancamentoFinanceiro,
    dataInicio: string,
    dataFim: string,
    opts: FiltroCruzado = {}
  ): Promise<number> {
    let query = this.queryBuilder()
      .select(this.selectParaFiltro(opts))
      .eq("tipo", tipo)
      .gte("data_competencia", dataInicio)
      .lte("data_competencia", dataFim);
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
      // `data:data_competencia` — quem agrupa por mês continua lendo `data`,
      // que aqui é a competência (migração 041).
      .select(
        opts.tipoTrabalho || opts.responsavel
          ? "data:data_competencia, valor, orcamento:orcamentos!inner(tipo_trabalho, atribuido_a)"
          : "data:data_competencia, valor"
      )
      .eq("tipo", tipo)
      .gte("data_competencia", dataInicio)
      .lte("data_competencia", dataFim);
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

  /** Lançamentos vinculados a um lead (`lead_id`) — usado pelo relatório de
   * comissões (migração 026) pra saber se a comissão de um lead "fechado" já
   * foi de fato recebida (`pago`), sem inflar `select` padrão de todo lugar
   * que lista lançamentos. */
  async listarPorLeadIds(leadIds: string[]): Promise<LancamentoFinanceiro[]> {
    if (leadIds.length === 0) return [];
    const { data, error } = await this.queryBuilder().select("id, lead_id, pago").in("lead_id", leadIds);
    if (error) throw error;
    return (data ?? []) as unknown as LancamentoFinanceiro[];
  }
}

interface FiltroCruzado {
  tipoTrabalho?: string;
  responsavel?: string;
}
