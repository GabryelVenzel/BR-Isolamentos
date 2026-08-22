export { atualizarLead } from "./atualizarLead";
export { criarLead } from "./criarLead";
export { moverLead } from "./moverLead";
export type { MoverLeadInput } from "./moverLead";
export { mudarTemperatura } from "./mudarTemperatura";
export { reativarLeadFrio } from "./reativarLeadFrio";
export { cancelarAgendamentoFrio } from "./cancelarAgendamentoFrio";
export { verificarReativacoesPendentes } from "./verificarReativacoesPendentes";
export { registrarInteracao } from "./registrarInteracao";
export { anexarPrazoEtapa, calcularDiasNaEtapaAtual } from "./prazoEtapa";
export {
  calcularFunil,
  calcularKpis,
  calcularLeadsDormindo,
  calcularLeadsFriosResumo,
  calcularLeadsPorOrigem,
  calcularPerformancePorResponsavel,
  calcularTempoMedioPorEtapa,
  gerarRelatorioComercial,
} from "./relatorio";
export type {
  EtapaFunilRelatorio,
  FunilComercial,
  KpisComercial,
  LeadsFriosResumo,
  LeadsPorOrigem,
  PerformanceResponsavel,
  RelatorioComercial,
  TempoMedioEtapa,
} from "./relatorio";
