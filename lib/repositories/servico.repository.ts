import type { SupabaseClient } from "@supabase/supabase-js";
import type { EtapaServico, Servico, TipoTrabalhoOperacional } from "../types/domain";
import { BaseRepository } from "./base";

export interface FiltrosServico {
  etapa?: EtapaServico | string;
  tipoTrabalho?: TipoTrabalhoOperacional | string;
  responsavelEmail?: string;
  criadosApartirDe?: string;
  /** Até esta data (ISO, inclusive) — ver mesmo campo em FiltrosLead. */
  criadosAte?: string;
}

export class ServicoRepository extends BaseRepository<Servico> {
  // Cliente + parceiro principal (legado) + parceiros vinculados (modelo
  // atual, ver sql-migration-013) resolvidos via join — o Kanban e o modal de
  // detalhes sempre precisam do nome, não só do id.
  protected select =
    "*, cliente:clientes(*), parceiro_principal:parceiros(*), parceiros_execucao:servico_parceiros_execucao(*, parceiro:parceiros(*)), funcionarios_execucao:servico_funcionarios_execucao(*, funcionario:funcionarios(id, nome, cargo, status))";

  constructor(supabase: SupabaseClient) {
    super(supabase, "servicos");
  }

  // LIXEIRA (migração 045): serviço com `excluido_em` preenchido some de
  // TODAS as consultas normais deste repositório (listas, busca por id,
  // capacidade, relatórios). Só os métodos da seção "Lixeira", no fim da
  // classe, enxergam o que está lá.

  /** Busca por id — um serviço na lixeira conta como inexistente. */
  async findById(id: string | number): Promise<Servico | null> {
    const { data, error } = await this.queryBuilder().select(this.select).eq("id", id).is("excluido_em", null).maybeSingle();
    if (error) throw error;
    return (data as unknown as Servico) ?? null;
  }

  async listar(filtros: FiltrosServico = {}): Promise<Servico[]> {
    let query = this.queryBuilder().select(this.select).is("excluido_em", null).order("created_at", { ascending: false });

    if (filtros.etapa) query = query.eq("etapa", filtros.etapa);
    if (filtros.tipoTrabalho) query = query.eq("tipo_trabalho", filtros.tipoTrabalho);
    if (filtros.responsavelEmail) query = query.eq("responsavel_email", filtros.responsavelEmail);
    if (filtros.criadosApartirDe) query = query.gte("created_at", filtros.criadosApartirDe);
    if (filtros.criadosAte) query = query.lte("created_at", filtros.criadosAte);

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
      .is("excluido_em", null)
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
      .is("excluido_em", null)
      .neq("etapa", "finalizado")
      .not("data_inicio", "is", null)
      .lte("data_inicio", dataFim)
      .or(`data_fim_prevista.is.null,data_fim_prevista.gte.${dataInicio}`);

    if (error) throw error;
    return (linhas ?? []) as unknown as Servico[];
  }

  /** Todos os serviços vinculados a um parceiro — usado pelo "Ver histórico"
   * da aba Capacidade/Parceiros. Precisa checar as DUAS fontes: o modelo
   * atual (`servico_parceiros_execucao`, ver sql-migration-013) e o legado
   * (`parceiro_principal_id`, serviços criados antes dessa migração que por
   * algum motivo não foram cobertos pelo backfill). */
  async listarPorParceiro(parceiroId: string): Promise<Servico[]> {
    const { data: execucoes, error: erroExecucoes } = await this.supabase
      .from("servico_parceiros_execucao")
      .select("servico_id")
      .eq("parceiro_id", parceiroId);
    if (erroExecucoes) throw erroExecucoes;

    const idsPorExecucao = (execucoes ?? []).map((e: { servico_id: string }) => e.servico_id);
    const condicoes = [`parceiro_principal_id.eq.${parceiroId}`];
    if (idsPorExecucao.length > 0) condicoes.push(`id.in.(${idsPorExecucao.join(",")})`);

    const { data, error } = await this.queryBuilder()
      .select(this.select)
      .is("excluido_em", null)
      .or(condicoes.join(","))
      .order("data_inicio", { ascending: false });

    if (error) throw error;
    return (data ?? []) as unknown as Servico[];
  }

  // --- Lixeira (migração 045) ---

  /** Serviços na lixeira, do excluído mais recentemente para o mais antigo. */
  async listarLixeira(): Promise<Servico[]> {
    const { data, error } = await this.queryBuilder().select(this.select).not("excluido_em", "is", null).order("excluido_em", { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as Servico[];
  }

  /** "Excluir" = mandar pra lixeira. Devolve `false` se o serviço não existe
   * ou já estava lá. */
  async moverParaLixeira(id: string, usuarioEmail: string | null): Promise<boolean> {
    const { data, error } = await this.queryBuilder()
      .update({ excluido_em: new Date().toISOString(), excluido_por: usuarioEmail })
      .eq("id", id)
      .is("excluido_em", null)
      .select("id");
    if (error) throw error;
    return (data ?? []).length > 0;
  }

  async restaurarDaLixeira(id: string): Promise<boolean> {
    const { data, error } = await this.queryBuilder()
      .update({ excluido_em: null, excluido_por: null })
      .eq("id", id)
      .not("excluido_em", "is", null)
      .select("id");
    if (error) throw error;
    return (data ?? []).length > 0;
  }

  /** Remoção DEFINITIVA — só de quem já está na lixeira (o filtro impede
   * apagar de vez um serviço ativo por engano). Parceiros, diárias, linha do
   * tempo e interações vão junto; os lançamentos ficam, sem o vínculo. */
  async excluirDefinitivamente(id: string): Promise<boolean> {
    const { data, error } = await this.queryBuilder().delete().eq("id", id).not("excluido_em", "is", null).select("id");
    if (error) throw error;
    return (data ?? []).length > 0;
  }

  /** Remove de vez o que está na lixeira desde antes de `limiteISO` —
   * chamado pela rotina diária. Devolve os códigos removidos. */
  async esvaziarLixeiraAnteriorA(limiteISO: string): Promise<string[]> {
    const { data, error } = await this.queryBuilder().delete().not("excluido_em", "is", null).lt("excluido_em", limiteISO).select("numero_servico");
    if (error) throw error;
    return ((data ?? []) as Array<{ numero_servico: string }>).map((s) => s.numero_servico);
  }
}
