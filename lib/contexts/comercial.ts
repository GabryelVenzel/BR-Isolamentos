// Contexto de negócio do módulo Comercial (CRM completo — Kanban, clientes,
// leads frios, relatórios).
//
// Ponto único de import para telas e API routes que trabalham com o CRM —
// reúne os repositórios e os use cases de `lib/usecases/comercial` atrás de
// uma fachada injetada com o client do Supabase da requisição atual. Mesmo
// padrão de `lib/contexts/orcamento.ts`.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AgendamentoLeadFrioRepository,
  ClienteRepository,
  ConfigPrazoEtapasRepository,
  ConfigReativacaoLeadsFriosRepository,
  HistoricoMudancaLeadRepository,
  InteracaoLeadRepository,
  LeadRepository,
  OrcamentoRepository,
  type FiltrosLead,
} from "../repositories";
import type {
  AgendamentoLeadFrio,
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
  anexarPrazoEtapa,
  atualizarLead,
  cancelarAgendamentoFrio,
  criarLead,
  gerarRelatorioComercial,
  moverLead,
  mudarTemperatura,
  reativarLeadFrio,
  registrarInteracao,
  verificarReativacoesPendentes,
  vincularOrcamento,
  type RelatorioComercial,
} from "../usecases/comercial";

export function createComercialContext(supabase: SupabaseClient) {
  const leadRepo = new LeadRepository(supabase);
  const interacaoRepo = new InteracaoLeadRepository(supabase);
  const historicoRepo = new HistoricoMudancaLeadRepository(supabase);
  const agendamentoFrioRepo = new AgendamentoLeadFrioRepository(supabase);
  const configReativacaoRepo = new ConfigReativacaoLeadsFriosRepository(supabase);
  const configPrazoEtapasRepo = new ConfigPrazoEtapasRepository(supabase);
  const clienteRepo = new ClienteRepository(supabase);
  const orcamentoRepo = new OrcamentoRepository(supabase);

  const reposMudancaEtapa = { leadRepo, historicoRepo };
  const reposVincularOrcamento = { leadRepo, orcamentoRepo, historicoRepo };
  const reposTemperatura = { leadRepo, historicoRepo, agendamentoFrioRepo, configReativacaoRepo };
  const reposReativacao = { leadRepo, historicoRepo, agendamentoFrioRepo };

  return {
    leadRepo,
    interacaoRepo,
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

      const [historico, config] = await Promise.all([
        historicoRepo.listarPorLeads(leads.map((l) => l.id)),
        configPrazoEtapasRepo.obter().catch(() => null),
      ]);

      return anexarPrazoEtapa(leads, historico, config);
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

    moverLead(leadId: string, novaEtapa: EtapaFunil, usuarioEmail?: string | null): Promise<Lead> {
      return moverLead({ leadId, novaEtapa }, reposMudancaEtapa, usuarioEmail);
    },

    mudarTemperatura(
      leadId: string,
      novaTemperatura: TemperaturaLead,
      intervaloDiasCustom: number | undefined,
      usuarioEmail?: string | null
    ): Promise<{ lead: Lead; agendamento: AgendamentoLeadFrio | null }> {
      return mudarTemperatura({ leadId, novaTemperatura, intervaloDiasCustom }, reposTemperatura, usuarioEmail);
    },

    removerLead(id: string): Promise<void> {
      return leadRepo.delete(id);
    },

    /** Integração Lead→Orçamento→Serviço: vincula um orçamento ao lead,
     * pré-requisito pra mover pra "proposta" (ver moverLead.ts). O seletor
     * "Vincular Orçamento" do LeadDetailModal usa a rota já existente
     * GET /api/orcamentos?cliente_id=X pra listar as opções, sem precisar de
     * um método/rota novos só pra isso. */
    vincularOrcamento(leadId: string, orcamentoId: number, usuarioEmail?: string | null): Promise<Lead> {
      return vincularOrcamento({ leadId, orcamentoId }, reposVincularOrcamento, usuarioEmail);
    },

    // --- Interações (timeline de contato) ---

    listarInteracoes(leadId: string): Promise<InteracaoLead[]> {
      return interacaoRepo.listarPorLead(leadId);
    },

    registrarInteracao(dados: unknown): Promise<InteracaoLead> {
      return registrarInteracao(dados, { leadRepo, interacaoRepo });
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
    }): Promise<RelatorioComercial> {
      const leads = await leadRepo.listar(filtros);
      const historico = leads.length > 0 ? await historicoRepo.listarPorLeads(leads.map((l) => l.id)) : [];
      const agendamentosFrios = await agendamentoFrioRepo.listarAgendados();
      return gerarRelatorioComercial(leads, historico, agendamentosFrios);
    },
  };
}

export type ComercialContext = ReturnType<typeof createComercialContext>;
