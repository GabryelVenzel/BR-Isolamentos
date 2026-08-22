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
  // Cliente resolvido via join — todo lugar que lista/mostra um lead precisa
  // do nome do cliente junto (card do Kanban, detalhe, timeline).
  protected select = "*, cliente:clientes(*)";

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

  /** Origens distintas já cadastradas (para popular o filtro "Origem" sem
   * hardcodar uma lista fixa — a origem é texto livre, ver CreateLeadSchema). */
  async listarOrigensDistintas(): Promise<string[]> {
    const { data, error } = await this.queryBuilder().select("origem").not("origem", "is", null);
    if (error) throw error;
    const origens = new Set((data ?? []).map((linha: { origem: string }) => linha.origem).filter(Boolean));
    return Array.from(origens).sort() as string[];
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
   * passado) — alimenta o alerta "leads sem contato" do dashboard. */
  async listarComAcaoAtrasada(): Promise<Lead[]> {
    const hoje = new Date().toISOString().slice(0, 10);
    const { data, error } = await this.queryBuilder()
      .select(this.select)
      .not("etapa", "in", "(fechado,perdido)")
      .not("data_proxima_acao", "is", null)
      .lt("data_proxima_acao", hoje);
    if (error) throw error;
    return (data ?? []) as unknown as Lead[];
  }

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
