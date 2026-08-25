import type { LancamentoFinanceiroRepository, LeadRepository, ParceiroRepository } from "../../repositories";
import type { AlertaResumo } from "../../types/resumo";
import { formatarMoeda } from "../../format";
import { calcularLeadsDormindo } from "../comercial";

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
 *
 * "Leads sem contato" usa `calcularLeadsDormindo` (mesma função que já
 * alimenta o painel "Leads Dormindo" em Resumo → Comercial — ver
 * lib/usecases/comercial/relatorio.ts) — sem contato (`data_ultima_interacao`,
 * ou `created_at` se nunca teve) há 7+ dias. ANTES este alerta usava
 * `leadRepo.listarComAcaoAtrasada()` (`data_proxima_acao < hoje`), um campo
 * que a UI de edição do lead parou de gravar faz tempo (ver comentário em
 * components/modules/comercial/LeadDetailModal.tsx: "esse acompanhamento
 * passou a ser feito via Interações, não mais um campo solto no cadastro") —
 * o alerta ficava mostrando leads com base num dado órfão, sem nenhuma tela
 * pra sequer ver/resolver de novo (daí o bug reportado: alerta aparecia, mas
 * não havia nada de fato atrasado do ponto de vista de quem usa o sistema
 * hoje). O link também mudou: pra Resumo → Comercial (`/resumo?tab=comercial`),
 * que já tem o painel "Leads Dormindo" com a lista — não pra `/comercial`
 * (Kanban), que não tem um filtro equivalente pra esse recorte específico.
 */
export async function listarAlertas(
  repos: ReposAlertas,
  diasNegativosProjecao: { primeiroDiaNegativo: number; totalDiasNegativos: number } | null
): Promise<AlertaResumo[]> {
  const alertas: AlertaResumo[] = [];

  const [aReceber, todosLeads, capacidade] = await Promise.all([
    repos.lancamentoRepo.listarAReceber(),
    repos.leadRepo.listar(),
    repos.parceiroRepo.capacidadeView(),
  ]);
  const leadsDormindo = calcularLeadsDormindo(todosLeads);

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

  if (leadsDormindo.length > 0) {
    alertas.push({
      id: "leads-sem-contato",
      severidade: "atencao",
      mensagem: `${leadsDormindo.length} lead${leadsDormindo.length > 1 ? "s" : ""} sem contato há 7+ dias`,
      href: "/resumo?tab=comercial",
      acaoLabel: "Ver leads dormindo",
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
