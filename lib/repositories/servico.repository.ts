import type { SupabaseClient } from "@supabase/supabase-js";
import type { EtapaServico, Servico, TipoTrabalhoOperacional } from "../types/domain";
import { BaseRepository } from "./base";

export interface FiltrosServico {
  etapa?: EtapaServico | string;
  tipoTrabalho?: TipoTrabalhoOperacional | string;
  responsavelEmail?: string;
  criadosApartirDe?: string;
}

export class ServicoRepository extends BaseRepository<Servico> {
  // Cliente + parceiro principal resolvidos via join — o Kanban e o modal de
  // detalhes sempre precisam do nome, não só do id.
  protected select = "*, cliente:clientes(*), parceiro_principal:parceiros(*)";

  constructor(supabase: SupabaseClient) {
    super(supabase, "servicos");
  }

  async listar(filtros: FiltrosServico = {}): Promise<Servico[]> {
    let query = this.queryBuilder().select(this.select).order("created_at", { ascending: false });

    if (filtros.etapa) query = query.eq("etapa", filtros.etapa);
    if (filtros.tipoTrabalho) query = query.eq("tipo_trabalho", filtros.tipoTrabalho);
    if (filtros.responsavelEmail) query = query.eq("responsavel_email", filtros.responsavelEmail);
    if (filtros.criadosApartirDe) query = query.gte("created_at", filtros.criadosApartirDe);

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as unknown as Servico[];
  }

  /** Serviços ativos (não finalizados) cujo período `[data_inicio,
   * data_fim_prevista]` inclui `data` — base do cálculo de capacidade por
   * dia (ver lib/usecases/operacional/capacidade.ts). Serviços sem
   * `data_fim_prevista` são tratados como "em aberto" (ainda mobilizam a
   * partir de `data_inicio`, sem data de término conhecida). */
  async listarAtivosNoDia(data: string): Promise<Servico[]> {
    const { data: linhas, error } = await this.queryBuilder()
      .select(this.select)
      .neq("etapa", "finalizado")
      .not("data_inicio", "is", null)
      .lte("data_inicio", data)
      .or(`data_fim_prevista.is.null,data_fim_prevista.gte.${data}`);

    if (error) throw error;
    return (linhas ?? []) as unknown as Servico[];
  }

  /** Serviços ativos (não finalizados) cujo período `[data_inicio,
   * data_fim_prevista]` cruza com `[dataInicio, dataFim]` — usado pelo
   * calendário mensal de capacidade (ver lib/usecases/operacional/capacidade.ts
   * #calcularCapacidadeMes): busca o mês inteiro numa única query, em vez de
   * uma query por dia (até 31), e o cálculo por dia é feito em memória a
   * partir dessa lista. */
  async listarAtivosNoIntervalo(dataInicio: string, dataFim: string): Promise<Servico[]> {
    const { data: linhas, error } = await this.queryBuilder()
      .select(this.select)
      .neq("etapa", "finalizado")
      .not("data_inicio", "is", null)
      .lte("data_inicio", dataFim)
      .or(`data_fim_prevista.is.null,data_fim_prevista.gte.${dataInicio}`);

    if (error) throw error;
    return (linhas ?? []) as unknown as Servico[];
  }

  /** Todos os serviços com `parceiro_principal_id = parceiroId` — usado pelo
   * "Ver histórico" da aba Capacidade/Parceiros. */
  async listarPorParceiro(parceiroId: string): Promise<Servico[]> {
    const { data, error } = await this.queryBuilder()
      .select(this.select)
      .eq("parceiro_principal_id", parceiroId)
      .order("data_inicio", { ascending: false });

    if (error) throw error;
    return (data ?? []) as unknown as Servico[];
  }
}
