import type { LancamentoFinanceiroRepository, LeadRepository, ParceiroRepository } from "../../repositories";
import type { AlertaResumo } from "../../types/resumo";
import { formatarMoeda } from "../../format";

export interface ReposAlertas {
  lancamentoRepo: LancamentoFinanceiroRepository;
  leadRepo: LeadRepository;
  parceiroRepo: ParceiroRepository;
}

const LIMITE_UTILIZACAO_PARCEIRO = 90;

/**
 * Alertas críticos do dashboard executivo — 3 das 4 verificações do pedido
 * original ("contas vencidas", "leads sem contato", "parceiros no limite")
 * são diretas nos dados existentes. A 4ª ("caixa negativo esperado em N
 * dias") é calculada por `projecaoCaixa` (mesmo algoritmo do gráfico de
 * cash flow) — passada aqui já pronta (`diasNegativosProjecao`) em vez de
 * recalculada, pra não duplicar a query de projeção quando as duas rodam
 * juntas (ver lib/contexts/resumo.ts).
 */
export async function listarAlertas(
  repos: ReposAlertas,
  diasNegativosProjecao: { primeiroDiaNegativo: number; totalDiasNegativos: number } | null
): Promise<AlertaResumo[]> {
  const alertas: AlertaResumo[] = [];

  const [aReceber, leadsAtrasados, capacidade] = await Promise.all([
    repos.lancamentoRepo.listarAReceber(),
    repos.leadRepo.listarComAcaoAtrasada(),
    repos.parceiroRepo.capacidadeView(),
  ]);

  const hojeISO = new Date().toISOString().slice(0, 10);
  const vencidas = aReceber.filter((l) => l.data < hojeISO);
  if (vencidas.length > 0) {
    const total = vencidas.reduce((acc, l) => acc + l.valor, 0);
    alertas.push({
      id: "contas-vencidas",
      severidade: "critico",
      mensagem: `${vencidas.length} conta${vencidas.length > 1 ? "s" : ""} vencida${vencidas.length > 1 ? "s" : ""} — total ${formatarMoeda(total)}`,
      href: "/financeiro",
      acaoLabel: "Ir para Financeiro",
    });
  }

  if (leadsAtrasados.length > 0) {
    alertas.push({
      id: "leads-sem-contato",
      severidade: "atencao",
      mensagem: `${leadsAtrasados.length} lead${leadsAtrasados.length > 1 ? "s" : ""} com ação atrasada`,
      href: "/comercial",
      acaoLabel: "Ir para Comercial",
    });
  }

  const parceirosNoLimite = capacidade.filter((p) => p.percentual_utilizacao > LIMITE_UTILIZACAO_PARCEIRO);
  for (const parceiro of parceirosNoLimite) {
    alertas.push({
      id: `parceiro-limite-${parceiro.id}`,
      severidade: "atencao",
      mensagem: `Parceiro ${parceiro.nome} no limite de capacidade (${parceiro.percentual_utilizacao.toFixed(0)}%)`,
      href: "/operacional/parceiros",
      acaoLabel: "Ir para Operacional",
    });
  }

  if (diasNegativosProjecao) {
    alertas.push({
      id: "caixa-negativo",
      severidade: "critico",
      mensagem: `Caixa projetado fica negativo em ${diasNegativosProjecao.primeiroDiaNegativo} dia${diasNegativosProjecao.primeiroDiaNegativo > 1 ? "s" : ""}`,
      href: "/financeiro",
      acaoLabel: "Ver detalhes",
    });
  }

  return alertas;
}
