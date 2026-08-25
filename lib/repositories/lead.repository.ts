import type { SupabaseClient } from "@supabase/supabase-js";
import type { EtapaFunil, Lead } from "../types/domain";
import { BaseRepository } from "./base";

export interface FiltrosLead {
  etapa?: EtapaFunil | string;
  atribuidoA?: string;
  temperatura?: string;
  origem?: string;
  /** Só leads criados a partir desta data (ISO) — filtro "Período" do
   * Kanban/Relatórios. */
  criadosApartirDe?: string;
}

export class LeadRepository extends BaseRepository<Lead> {
  // Cliente + orçamento vinculado resolvidos via join — o card do Kanban e o
  // LeadDetailModal sempre precisam do nome do cliente, e o modal também do
  // número/valor do orçamento vinculado (integração Lead→Orçamento→Serviço).
  protected select = "*, cliente:clientes(*), orcamento:orcamentos(*)";

  constructor(supabase: SupabaseClient) {
    super(supabase, "leads");
  }

  async listar(filtros: FiltrosLead = {}): Promise<Lead[]> {
    let query = this.queryBuilder().select(this.select).order("created_at", { ascending: false });

    if (filtros.etapa) query = query.eq("etapa", filtros.etapa);
    if (filtros.atribuidoA) query = query.eq("atribuido_a", filtros.atribuidoA);
    if (filtros.temperatura) query = query.eq("temperatura", filtros.temperatura);
    if (filtros.origem) query = query.eq("origem", filtros.origem);
    if (filtros.criadosApartirDe) query = query.gte("created_at", filtros.criadosApartirDe);

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as unknown as Lead[];
  }

  // --- Consultas do dashboard executivo (módulo Resumo) ---

  /** Leads em qualquer etapa ativa (não terminal — nem fechado nem perdido),
   * opcionalmente restritos a um responsável. */
  async listarAtivos(atribuidoA?: string): Promise<Lead[]> {
    let query = this.queryBuilder().select(this.select).not("etapa", "in", "(fechado,perdido)");
    if (atribuidoA) query = query.eq("atribuido_a", atribuidoA);

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as unknown as Lead[];
  }

  /** Leads que mudaram pra `etapa` dentro do intervalo — usa `updated_at`
   * como proxy de "quando entrou na etapa" (a tabela não guarda histórico de
   * transição por etapa; `interacoes_lead` registra contatos, não mudanças
   * de etapa). Correto enquanto `moverLead` for a única forma de mudar
   * `etapa` (é hoje — ver lib/usecases/comercial/moverLead.ts). */
  async listarPorEtapaNoIntervalo(
    etapa: EtapaFunil,
    dataInicio: string,
    dataFim: string,
    atribuidoA?: string
  ): Promise<Lead[]> {
    let query = this.queryBuilder()
      .select(this.select)
      .eq("etapa", etapa)
      .gte("updated_at", dataInicio)
      .lte("updated_at", `${dataFim}T23:59:59`);
    if (atribuidoA) query = query.eq("atribuido_a", atribuidoA);

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as unknown as Lead[];
  }

  /** Contagem de leads criados no intervalo — base de "novos leads no
   * período" (KPI 2) e do denominador da taxa de conversão (KPI 3). */
  async contarCriadosNoIntervalo(dataInicio: string, dataFim: string, atribuidoA?: string): Promise<number> {
    let query = this.queryBuilder()
      .select("id", { count: "exact", head: true })
      .gte("created_at", dataInicio)
      .lte("created_at", `${dataFim}T23:59:59`);
    if (atribuidoA) query = query.eq("atribuido_a", atribuidoA);

    const { count, error } = await query;
    if (error) throw error;
    return count ?? 0;
  }

  /** Leads ativos cuja próxima ação já venceu (`data_proxima_acao` no
   * passado) — alimenta o alerta "leads sem contato" do dashboard Resumo.
   * NOTA: `proxima_acao`/`data_proxima_acao` deixaram de ser editáveis pela
   * UI do módulo Comercial (o acompanhamento passou a ser via Interações,
   * ver NovoLeadModal.tsx/LeadDetailModal.tsx) — leads criados depois dessa
   * mudança nunca preenchem esse campo, então este alerta tende a esvaziar
   * com o tempo. Não removido aqui porque a decisão de aposentar o alerta é
   * do módulo Resumo, fora do escopo deste pedido (que era só do Comercial). */
  /** Contagem total de leads (todas as etapas) — usado como denominador
   * alternativo de conversão histórica, se precisar no futuro. */
  async contarTodos(): Promise<number> {
    const { count, error } = await this.queryBuilder().select("id", { count: "exact", head: true });
    if (error) throw error;
    return count ?? 0;
  }

  /** Lê a view `v_leads_por_etapa` (contagem + valor total por etapa, todo o
   * funil de uma vez) — ver sql-migration-004-6modulos-completo.sql. */
  async porEtapaView(): Promise<Array<{ etapa: string; total: number; valor_total: number }>> {
    const { data, error } = await this.supabase.from("v_leads_por_etapa").select("*");
    if (error) throw error;
    return (data ?? []) as Array<{ etapa: string; total: number; valor_total: number }>;
  }
}
