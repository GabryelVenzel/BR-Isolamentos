// Contexto de negócio do módulo Comercial (CRM completo — Kanban, clientes,
// leads frios, relatórios).
//
// Ponto único de import para telas e API routes que trabalham com o CRM —
// reúne os repositórios e os use cases de `lib/usecases/comercial` atrás de
// uma fachada injetada com o client do Supabase da requisição atual. Mesmo
// padrão de `lib/contexts/orcamento.ts`.

import type { SupabaseClient } from "@supabase/supabase-js";
import { NotFoundError } from "../errors";
import {
  AgendamentoLeadFrioRepository,
  AnexoLeadRepository,
  ClienteRepository,
  ConfigPrazoEtapasRepository,
  ConfigReativacaoLeadsFriosRepository,
  HistoricoMudancaLeadRepository,
  InteracaoLeadRepository,
  LancamentoFinanceiroRepository,
  LeadRepository,
  OrcamentoRepository,
  LeadOrcamentoRepository,
  type FiltrosLead,
} from "../repositories";
import type {
  AgendamentoLeadFrio,
  AnexoLead,
  ClienteResumo,
  ConfigPrazoEtapas,
  ConfigReativacaoLeadsFrios,
  EtapaFunil,
  HistoricoMudancaLead,
  InteracaoLead,
  Lead,
  TemperaturaLead,
} from "../types/domain";
import {
  anexarArquivoLead,
  anexarPrazoEtapa,
  anexarTotalAnexos,
  atualizarLead,
  cancelarAgendamentoFrio,
  criarLead,
  gerarRelatorioComercial,
  calcularPipelinePorEtapa,
  calcularVendasPorMes,
  moverLead,
  mudarTemperatura,
  reativarLeadFrio,
  registrarInteracao,
  verificarReativacoesPendentes,
  vincularOrcamento,
  desvincularOrcamento,
  type RelatorioComercial,
} from "../usecases/comercial";

export function createComercialContext(supabase: SupabaseClient) {
  const leadRepo = new LeadRepository(supabase);
  const interacaoRepo = new InteracaoLeadRepository(supabase);
  const anexoLeadRepo = new AnexoLeadRepository(supabase);
  const historicoRepo = new HistoricoMudancaLeadRepository(supabase);
  const agendamentoFrioRepo = new AgendamentoLeadFrioRepository(supabase);
  const configReativacaoRepo = new ConfigReativacaoLeadsFriosRepository(supabase);
  const configPrazoEtapasRepo = new ConfigPrazoEtapasRepository(supabase);
  const clienteRepo = new ClienteRepository(supabase);
  const orcamentoRepo = new OrcamentoRepository(supabase);
  const leadOrcamentoRepo = new LeadOrcamentoRepository(supabase);
  const lancamentoRepo = new LancamentoFinanceiroRepository(supabase);

  const reposMudancaEtapa = { leadRepo, historicoRepo };
  // anexoLeadRepo/lancamentoRepo (migração 026) — comissão troca a exigência
  // de orçamento por anexo em "negociação", e gera um lançamento automático
  // ao fechar (ver moverLead.ts).
  const reposMoverLead = { leadRepo, historicoRepo, orcamentoRepo, anexoLeadRepo, lancamentoRepo, leadOrcamentoRepo };
  const reposVincularOrcamento = { leadRepo, orcamentoRepo, historicoRepo, leadOrcamentoRepo };
  const reposTemperatura = { leadRepo, historicoRepo, agendamentoFrioRepo, configReativacaoRepo };
  const reposReativacao = { leadRepo, historicoRepo, agendamentoFrioRepo };

  return {
    leadRepo,
    interacaoRepo,
    anexoLeadRepo,
    historicoRepo,
    agendamentoFrioRepo,
    configReativacaoRepo,
    configPrazoEtapasRepo,
    clienteRepo,

    // --- Leads / Kanban ---

    /** Anexa `dias_na_etapa_atual`/`etapa_atrasada` em cada lead antes de
     * devolver — ver lib/usecases/comercial/prazoEtapa.ts. Se
     * config_prazo_etapas ainda não existir (migração 006 não aplicada), o
     * `.catch` degrada pra "sem prazo configurado": os leads continuam
     * listados normalmente, só sem nenhum marcado como atrasado. */
    async listarLeads(filtros?: FiltrosLead): Promise<Lead[]> {
      const leads = await leadRepo.listar(filtros);
      if (leads.length === 0) return leads;

      const leadsComissao = leads.filter((l) => l.eh_comissao);
      const [historico, config, contagemAnexos] = await Promise.all([
        historicoRepo.listarPorLeads(leads.map((l) => l.id)),
        configPrazoEtapasRepo.obter().catch(() => null),
        // Só busca contagem de anexos pros leads de comissão (a maioria dos
        // Kanbans não tem nenhum) — evita uma query em branco na maioria dos
        // casos.
        leadsComissao.length > 0 ? anexoLeadRepo.contarPorLeads(leadsComissao.map((l) => l.id)) : Promise.resolve({}),
      ]);

      return anexarTotalAnexos(anexarPrazoEtapa(leads, historico, config), contagemAnexos);
    },

    buscarLead(id: string): Promise<Lead> {
      return leadRepo.findByIdOrThrow(id);
    },

    criarLead(dados: unknown, usuarioEmail?: string | null): Promise<Lead> {
      return criarLead(dados, reposMudancaEtapa, usuarioEmail);
    },

    atualizarLead(id: string, dados: unknown): Promise<Lead> {
      return atualizarLead(id, dados, { leadRepo });
    },

    moverLead(leadId: string, novaEtapa: EtapaFunil, usuarioEmail?: string | null, valorFechado?: number, orcamentosVencedores?: number[]): Promise<Lead> {
      return moverLead({ leadId, novaEtapa, valorFechado, orcamentosVencedores }, reposMoverLead, usuarioEmail);
    },

    mudarTemperatura(
      leadId: string,
      novaTemperatura: TemperaturaLead,
      intervaloDiasCustom: number | undefined,
      usuarioEmail?: string | null
    ): Promise<{ lead: Lead; agendamento: AgendamentoLeadFrio | null }> {
      return mudarTemperatura({ leadId, novaTemperatura, intervaloDiasCustom }, reposTemperatura, usuarioEmail);
    },

    /** "Excluir" um lead = mandar pra lixeira (migração 047): some das
     * telas, com histórico, interações e anexos preservados; restaurar ou
     * remover de vez é do administrador (lib/contexts/lixeira.ts). */
    async removerLead(id: string, usuarioEmail?: string | null): Promise<void> {
      if (!(await leadRepo.moverParaLixeira(id, usuarioEmail ?? null))) throw new NotFoundError("Lead não encontrado.");
    },

    /** Integração Lead→Orçamento→Serviço: vincula um orçamento ao lead,
     * pré-requisito pra mover pra "proposta" (ver moverLead.ts). O seletor
     * "Vincular Orçamento" do LeadDetailModal usa a rota já existente
     * GET /api/orcamentos?cliente_id=X pra listar as opções, sem precisar de
     * um método/rota novos só pra isso. */
    vincularOrcamento(leadId: string, orcamentoId: number, usuarioEmail?: string | null): Promise<Lead> {
      return vincularOrcamento({ leadId, orcamentoId }, reposVincularOrcamento, usuarioEmail);
    },

    /** Remove um orçamento do lead — só até a etapa Proposta (migração 053). */
    desvincularOrcamento(leadId: string, orcamentoId: number, usuarioEmail?: string | null): Promise<Lead> {
      return desvincularOrcamento({ leadId, orcamentoId }, reposVincularOrcamento, usuarioEmail);
    },

    // --- Interações (timeline de contato) ---

    listarInteracoes(leadId: string): Promise<InteracaoLead[]> {
      return interacaoRepo.listarPorLead(leadId);
    },

    registrarInteracao(dados: unknown): Promise<InteracaoLead> {
      return registrarInteracao(dados, { leadRepo, interacaoRepo });
    },

    // --- Anexos (documentos do lead) ---

    listarAnexos(leadId: string): Promise<AnexoLead[]> {
      return anexoLeadRepo.listarPorLead(leadId);
    },

    anexarArquivoLead(dados: unknown): Promise<AnexoLead> {
      return anexarArquivoLead(dados, { leadRepo, anexoLeadRepo });
    },

    removerAnexoLead(anexoId: string): Promise<void> {
      return anexoLeadRepo.delete(anexoId);
    },

    // --- Histórico de mudanças (timeline "Caminho do lead") ---

    listarHistorico(leadId: string): Promise<HistoricoMudancaLead[]> {
      return historicoRepo.listarPorLead(leadId);
    },

    // --- Leads frios ---

    async listarLeadsFrios(): Promise<AgendamentoLeadFrio[]> {
      await verificarReativacoesPendentes(reposReativacao);
      return agendamentoFrioRepo.listarAgendados();
    },

    reativarLeadFrio(agendamentoId: string, usuarioEmail?: string | null): Promise<Lead> {
      return reativarLeadFrio(agendamentoId, reposReativacao, usuarioEmail ?? null, true);
    },

    cancelarAgendamentoFrio(agendamentoId: string, dados: unknown): Promise<AgendamentoLeadFrio> {
      return cancelarAgendamentoFrio(agendamentoId, dados, { agendamentoFrioRepo });
    },

    /** Sweep sob demanda — chamado no início de qualquer listagem que deva
     * refletir reativações vencidas (ver verificarReativacoesPendentes.ts). */
    verificarReativacoesPendentes(): Promise<number> {
      return verificarReativacoesPendentes(reposReativacao);
    },

    // --- Configuração de prazos de reativação ---

    obterConfigReativacao(): Promise<ConfigReativacaoLeadsFrios> {
      return configReativacaoRepo.obter();
    },

    atualizarConfigReativacao(dados: Partial<ConfigReativacaoLeadsFrios>): Promise<ConfigReativacaoLeadsFrios> {
      return configReativacaoRepo.atualizar(dados);
    },

    // --- Configuração de prazo máximo por etapa (leads "atrasados") ---

    obterConfigPrazoEtapas(): Promise<ConfigPrazoEtapas> {
      return configPrazoEtapasRepo.obter();
    },

    atualizarConfigPrazoEtapas(dados: Partial<ConfigPrazoEtapas>): Promise<ConfigPrazoEtapas> {
      return configPrazoEtapasRepo.atualizar(dados);
    },

    // --- Clientes ---

    listarClientesComResumo(busca?: string): Promise<ClienteResumo[]> {
      return clienteRepo.listarComResumo(busca);
    },

    // --- Relatórios ---

    async gerarRelatorio(filtros: {
      atribuidoA?: string;
      temperatura?: string;
      criadosApartirDe?: string;
      criadosAte?: string;
    }): Promise<RelatorioComercial> {
      const leads = await leadRepo.listar(filtros);
      const historico = leads.length > 0 ? await historicoRepo.listarPorLeads(leads.map((l) => l.id)) : [];
      const agendamentosFrios = await agendamentoFrioRepo.listarAgendados();

      // Status "Recebido" do relatório de comissões precisa saber se o
      // lançamento gerado ao fechar já foi marcado como pago (ver
      // calcularComissoes) — só busca pros leads "fechado" de comissão.
      const leadsFechadosComissao = leads.filter((l) => l.eh_comissao && l.etapa === "fechado");
      const lancamentos =
        leadsFechadosComissao.length > 0 ? await lancamentoRepo.listarPorLeadIds(leadsFechadosComissao.map((l) => l.id)) : [];
      const lancamentosPagoPorLeadId: Record<string, boolean> = {};
      for (const lancamento of lancamentos) {
        if (lancamento.lead_id) lancamentosPagoPorLeadId[lancamento.lead_id] = lancamento.pago;
      }

      const relatorio = gerarRelatorioComercial(leads, historico, agendamentosFrios, new Date(), lancamentosPagoPorLeadId);

      // Vendas por mês e pipeline por etapa não dependem de QUANDO o lead foi
      // criado: usam todos os leads (com os mesmos filtros de responsável e
      // temperatura) — senão "vendas de 6 meses" mostraria só o mês filtrado.
      const todos = await leadRepo.listar({ atribuidoA: filtros.atribuidoA, temperatura: filtros.temperatura });
      const fechados = todos.filter((l) => l.etapa === "fechado");
      const historicoFechados = fechados.length > 0 ? await historicoRepo.listarPorLeads(fechados.map((l) => l.id)) : [];
      return {
        ...relatorio,
        vendasPorMes: calcularVendasPorMes(todos, historicoFechados),
        pipelinePorEtapa: calcularPipelinePorEtapa(todos),
      };
    },
  };
}

export type ComercialContext = ReturnType<typeof createComercialContext>;
