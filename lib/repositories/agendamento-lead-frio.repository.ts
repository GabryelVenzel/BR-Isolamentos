import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgendamentoLeadFrio } from "../types/domain";
import { BaseRepository } from "./base";

export class AgendamentoLeadFrioRepository extends BaseRepository<AgendamentoLeadFrio> {
  // Join com lead+cliente — a seção "Leads Frios em Reativação" e o relatório
  // precisam do nome do cliente e do valor estimado sem query extra.
  protected select = "*, lead:leads(*, cliente:clientes(*))";

  constructor(supabase: SupabaseClient) {
    super(supabase, "agendamentos_leads_frios");
  }

  /** Agendamentos ainda pendentes (status "agendado"), mais recentes por
   * data de retorno primeiro — ver LeadsFriosPanel.tsx. */
  async listarAgendados(): Promise<AgendamentoLeadFrio[]> {
    const { data, error } = await this.queryBuilder()
      .select(this.select)
      .eq("status", "agendado")
      .order("data_retorno", { ascending: true });

    if (error) throw error;
    return (data ?? []) as unknown as AgendamentoLeadFrio[];
  }

  /** Agendamentos "agendado" cujo prazo já venceu (`data_retorno <= agora`) —
   * a lista que o sweep sob demanda reativa (ver
   * lib/usecases/comercial/verificarReativacoesPendentes.ts). `agoraIso` é
   * recebido de fora (não usa `now()` do Postgres) para o teste unitário
   * poder controlar o "agora" sem mockar o relógio do banco. */
  async listarVencidos(agoraIso: string): Promise<AgendamentoLeadFrio[]> {
    const { data, error } = await this.queryBuilder()
      .select(this.select)
      .eq("status", "agendado")
      .lte("data_retorno", agoraIso);

    if (error) throw error;
    return (data ?? []) as unknown as AgendamentoLeadFrio[];
  }

  async marcarReativado(id: string): Promise<AgendamentoLeadFrio> {
    return this.update(id, {
      status: "reativado",
      reativado_em: new Date().toISOString(),
    } as Partial<AgendamentoLeadFrio>);
  }

  async marcarCancelado(id: string, motivo: string | null): Promise<AgendamentoLeadFrio> {
    return this.update(id, {
      status: "cancelado",
      motivo_cancelamento: motivo,
    } as Partial<AgendamentoLeadFrio>);
  }
}
