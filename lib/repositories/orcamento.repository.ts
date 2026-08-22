import type { SupabaseClient } from "@supabase/supabase-js";
import type { ItemOrcamento, Orcamento, StatusOrcamento } from "../types";
import { BaseRepository } from "./base";

export interface FiltrosOrcamento {
  status?: StatusOrcamento | string;
  clienteId?: number | string;
  dataInicio?: string;
  dataFim?: string;
}

export class OrcamentoRepository extends BaseRepository<Orcamento> {
  // Traz cliente e itens já resolvidos via join — evita N+1 nas telas de
  // histórico/detalhe, que sempre precisam desses dados juntos.
  protected select = "*, cliente:clientes(*), itens:itens_orcamento(*)";

  constructor(supabase: SupabaseClient) {
    super(supabase, "orcamentos");
  }

  async listar(filtros: FiltrosOrcamento = {}): Promise<Orcamento[]> {
    let query = this.queryBuilder().select(this.select).order("criado_em", { ascending: false });

    if (filtros.status) query = query.eq("status", filtros.status);
    if (filtros.clienteId) query = query.eq("cliente_id", filtros.clienteId);
    if (filtros.dataInicio) query = query.gte("data_criacao", filtros.dataInicio);
    if (filtros.dataFim) query = query.lte("data_criacao", filtros.dataFim);

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as unknown as Orcamento[];
  }

  /** Próximo número sequencial de orçamento no formato `ORC-<ano>-<seq>`. Não é
   * atômico (mesma limitação do código original) — aceitável no volume atual de
   * uso por um único operador; se o cadastro passar a ser concorrente, mover
   * para uma sequence/função no Postgres. */
  async proximoNumero(): Promise<string> {
    const { count, error } = await this.queryBuilder().select("id", { count: "exact", head: true });
    if (error) throw error;
    return `ORC-${new Date().getFullYear()}-${String((count ?? 0) + 1).padStart(4, "0")}`;
  }

  async criarComItens(
    cabecalho: Partial<Orcamento>,
    itens: Array<Partial<ItemOrcamento>>,
    criadoPor: string | null
  ): Promise<Orcamento> {
    const numero = await this.proximoNumero();

    const { data: orcamento, error: erroOrcamento } = await this.queryBuilder()
      .insert({ ...cabecalho, numero, criado_por: criadoPor })
      .select()
      .single();

    if (erroOrcamento) throw erroOrcamento;

    const { error: erroItens } = await this.supabase
      .from("itens_orcamento")
      .insert(itens.map((item) => ({ ...item, orcamento_id: orcamento.id })));

    if (erroItens) {
      // evita orçamento órfão sem itens
      await this.queryBuilder().delete().eq("id", orcamento.id);
      throw erroItens;
    }

    return this.findByIdOrThrow(orcamento.id);
  }

  /** Orçamentos aceitos num intervalo (por `data_criacao`), só as colunas
   * usadas pra "Distribuição de Receita por Tipo" do dashboard (Resumo) —
   * soma `valor_final` agrupado por `tipo_trabalho` no use case chamador.
   * Usa o valor de venda do orçamento (não o que já foi efetivamente
   * recebido em `lancamentos_financeiros`) porque nem todo orçamento aceito
   * necessariamente tem um lançamento financeiro vinculado ainda — como
   * indicador de "mix de vendas por tipo de trabalho" isso é mais confiável
   * que depender dessa vinculação manual. */
  async listarAceitosPorPeriodo(
    dataInicio: string,
    dataFim: string,
    responsavel?: string
  ): Promise<Array<{ tipo_trabalho: string; valor_final: number }>> {
    let query = this.queryBuilder()
      .select("tipo_trabalho, valor_final")
      .eq("status", "aceito")
      .gte("data_criacao", dataInicio)
      .lte("data_criacao", dataFim);
    if (responsavel) query = query.eq("atribuido_a", responsavel);

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as Array<{ tipo_trabalho: string; valor_final: number }>;
  }
}
