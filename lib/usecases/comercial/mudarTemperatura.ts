import { NotFoundError } from "../../errors";
import type {
  AgendamentoLeadFrioRepository,
  ConfigReativacaoLeadsFriosRepository,
  HistoricoMudancaLeadRepository,
  LeadRepository,
} from "../../repositories";
import type { AgendamentoLeadFrio, ConfigReativacaoLeadsFrios, EtapaFunil, HistoricoMudancaLead, Lead } from "../../types/domain";
import { MudarTemperaturaSchema, parseOrThrow } from "../../validators";

/** Prazo padrão (em dias) de reativação conforme a etapa em que o lead
 * esfriou, lido da configuração editável (ver ConfiguracoesTab.tsx). Leads
 * que esfriam já "fechado" ou "perdido" são um caso de borda que o mockup não
 * cobre — usa o mesmo prazo de "negociação" (o mais longo) em vez de travar
 * a operação. */
function diasPadraoParaEtapa(etapa: EtapaFunil, config: ConfigReativacaoLeadsFrios): number {
  switch (etapa) {
    case "prospeccao":
      return config.dias_prospeccao;
    case "contato":
      return config.dias_contato;
    case "proposta":
      return config.dias_proposta;
    case "negociacao":
    case "fechado":
    case "perdido":
    default:
      return config.dias_negociacao;
  }
}

/** Muda a temperatura de um lead. Separado de `atualizarLead` (como
 * `moverLead`) porque tem efeito colateral: virar "Frio" agenda uma
 * reativação automática (ver checklist do pedido — "AUTOMAÇÃO LEADS
 * FRIOS"). O agendamento usa o prazo configurado para a etapa ATUAL do lead
 * (ex.: esfriou em "Contato" → volta em `dias_contato` dias), ou um prazo
 * customizado se informado. */
export async function mudarTemperatura(
  input: unknown,
  repos: {
    leadRepo: LeadRepository;
    historicoRepo: HistoricoMudancaLeadRepository;
    agendamentoFrioRepo: AgendamentoLeadFrioRepository;
    configReativacaoRepo: ConfigReativacaoLeadsFriosRepository;
  },
  usuarioEmail?: string | null
): Promise<{ lead: Lead; agendamento: AgendamentoLeadFrio | null }> {
  const { leadId, novaTemperatura, intervaloDiasCustom } = parseOrThrow(MudarTemperaturaSchema, input);

  const lead = await repos.leadRepo.findById(leadId);
  if (!lead) throw new NotFoundError(`Lead ${leadId} não encontrado.`);

  if (lead.temperatura === novaTemperatura) return { lead, agendamento: null };

  const leadAtualizado = await repos.leadRepo.update(leadId, {
    temperatura: novaTemperatura,
    temperatura_anterior: lead.temperatura,
  } as Partial<Lead>);

  await repos.historicoRepo.create({
    lead_id: leadId,
    tipo_mudanca: "mudanca_temperatura",
    temperatura_anterior: lead.temperatura,
    temperatura_nova: novaTemperatura,
    usuario_email: usuarioEmail ?? null,
  } as Partial<HistoricoMudancaLead>);

  if (novaTemperatura !== "frio") {
    return { lead: leadAtualizado, agendamento: null };
  }

  const config = await repos.configReativacaoRepo.obter();
  const dias = intervaloDiasCustom ?? diasPadraoParaEtapa(lead.etapa, config);
  const agora = new Date();
  const dataRetorno = new Date(agora.getTime() + dias * 24 * 60 * 60 * 1000);

  const agendamento = await repos.agendamentoFrioRepo.create({
    lead_id: leadId,
    temperatura_anterior: lead.temperatura,
    etapa_anterior: lead.etapa,
    data_agendamento: agora.toISOString(),
    data_retorno: dataRetorno.toISOString(),
    intervalo_dias: dias,
    status: "agendado",
  } as Partial<AgendamentoLeadFrio>);

  return { lead: leadAtualizado, agendamento };
}
