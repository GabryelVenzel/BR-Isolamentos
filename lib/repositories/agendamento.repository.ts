import type { SupabaseClient } from "@supabase/supabase-js";
import type { Agendamento, StatusAgendamento } from "../types/domain";
import { BaseRepository } from "./base";

export interface FiltrosAgendamento {
  status?: StatusAgendamento | string;
  dataInicio?: string;
  dataFim?: string;
  parceiroId?: string;
}

export class AgendamentoRepository extends BaseRepository<Agendamento> {
  // Traz o orçamento junto — a agenda sempre precisa mostrar pra qual
  // orçamento/cliente é o serviço, não só a data.
  protected select = "*, orcamento:orcamentos(*, cliente:clientes(*))";

  constructor(supabase: SupabaseClient) {
    super(supabase, "agendamentos");
  }

  async listar(filtros: FiltrosAgendamento = {}): Promise<Agendamento[]> {
    let query = this.queryBuilder().select(this.select).order("data_inicio", { ascending: true });

    if (filtros.status) query = query.eq("status", filtros.status);
    if (filtros.dataInicio) query = query.gte("data_inicio", filtros.dataInicio);
    if (filtros.dataFim) query = query.lte("data_inicio", filtros.dataFim);
    if (filtros.parceiroId) query = query.contains("parceiros_alocados", [filtros.parceiroId]);

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as unknown as Agendamento[];
  }
}
