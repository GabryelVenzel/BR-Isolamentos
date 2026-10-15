"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import TabsNavigation from "@/components/TabsNavigation";
import CabecalhoPagina from "@/components/ui/CabecalhoPagina";
import { EsqueletoLista } from "@/components/ui/Esqueleto";
import { useEstadoLembrado } from "@/lib/hooks/useEstadoLembrado";
import { toast } from "@/components/modules/comercial/toast";
import KanbanBoard from "@/components/modules/comercial/KanbanBoard";
import FiltrosKanban, { type FiltrosKanbanState } from "@/components/modules/comercial/FiltrosKanban";
import LeadsFriosPanel from "@/components/modules/comercial/LeadsFriosPanel";
import ClientesTab from "@/components/modules/comercial/ClientesTab";
import ListaParceiros from "@/components/modules/operacional/ListaParceiros";
import ConfiguracoesTab from "@/components/modules/comercial/ConfiguracoesTab";
import NovoLeadModal from "@/components/comercial/NovoLeadModal";
import ValorFechadoHost, { pedirValorFechado } from "@/components/modules/comercial/ValorFechado";
import { exigeValorFechado, valorDoLead } from "@/lib/leads";
import { formatarEtapa, formatarMoeda } from "@/lib/format";
import type { AgendamentoLeadFrio, EtapaFunil, Lead } from "@/lib/types/domain";
import { confirmar } from "@/components/ui/confirmar";
import Lixeira from "@/components/Lixeira";
import { useAcesso } from "@/lib/hooks/useAcesso";
import { orcamentosDoLead } from "@/lib/leads";

// A aba "Relatórios" que existia aqui foi removida — os relatórios
// comerciais (funil, origem, performance por responsável etc.) agora vivem
// centralizados em /resumo?tab=comercial, junto com os relatórios de
// Operacional e Financeiro (ver app/resumo/page.tsx).
type AbaComercial = "crm" | "clientes" | "parcerias" | "representantes" | "configuracoes";

const ABAS: Array<{ valor: AbaComercial; label: string }> = [
  { valor: "crm", label: "CRM" },
  { valor: "clientes", label: "Clientes" },
  // Migração 055 — Parcerias veio do Operacional; Representantes é novo.
  { valor: "parcerias", label: "Parcerias" },
  { valor: "representantes", label: "Representantes" },
  { valor: "configuracoes", label: "Configurações" },
];

const CHAVE_ABA = "br-isolamentos:comercial-aba";
const FILTROS_INICIAIS: FiltrosKanbanState = { busca: "", temperatura: "", origem: "", atribuidoA: "", periodo: "" };

export default function ComercialPage() {
  return (
    <Suspense fallback={null}>
      <ComercialPageConteudo />
    </Suspense>
  );
}

function ComercialPageConteudo() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [aba, setAba] = useState<AbaComercial>("crm");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [carregandoLeads, setCarregandoLeads] = useState(true);
  // Filtros lembrados entre visitas (revisão de usabilidade).
  const [filtros, setFiltros] = useEstadoLembrado<FiltrosKanbanState>("filtros-comercial", FILTROS_INICIAIS);
  const [usuarios, setUsuarios] = useState<Array<{ email: string; nome: string }>>([]);

  const [mostrarFrios, setMostrarFrios] = useState(false);
  const [leadsFrios, setLeadsFrios] = useState<AgendamentoLeadFrio[]>([]);
  const [carregandoFrios, setCarregandoFrios] = useState(false);

  const [soAtrasados, setSoAtrasados] = useEstadoLembrado("filtros-comercial-atrasados", false);
  const [soComissoes, setSoComissoes] = useEstadoLembrado("filtros-comercial-comissoes", false);
  // Migração 055 — filtro de representações ("" todas, "todos" só representações, ou um representante).
  const [filtroRepresentante, setFiltroRepresentante] = useEstadoLembrado("filtros-comercial-representante", "");
  const [mostrarPerdidos, setMostrarPerdidos] = useEstadoLembrado("filtros-comercial-perdidos", false);

  const [mostrarNovoLead, setMostrarNovoLead] = useState(false);
  const [mostrarLixeira, setMostrarLixeira] = useState(false);
  const { acesso } = useAcesso();

  // Aba selecionada persiste entre visitas (localStorage) — mesmo padrão de
  // outros módulos com sub-navegação. `?aba=` na URL tem prioridade (permite
  // linkar direto pra uma aba específica).
  useEffect(() => {
    const abaUrl = searchParams.get("aba") as AbaComercial | null;
    if (abaUrl && ABAS.some((a) => a.valor === abaUrl)) {
      setAba(abaUrl);
      return;
    }
    const salva = window.localStorage.getItem(CHAVE_ABA) as AbaComercial | null;
    if (salva && ABAS.some((a) => a.valor === salva)) setAba(salva);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function trocarAba(nova: AbaComercial) {
    setAba(nova);
    window.localStorage.setItem(CHAVE_ABA, nova);
  }

  // `?lead=<id>` (links antigos) leva à ficha do lead; `?novo=lead` (o
  // "+ Criar" do cabeçalho) abre o formulário de novo lead.
  useEffect(() => {
    const leadParam = searchParams.get("lead");
    if (leadParam) router.replace(`/comercial/leads/${leadParam}`);
    if (searchParams.get("novo") === "lead") setMostrarNovoLead(true);
  }, [searchParams, router]);

  const carregarLeads = useCallback(async () => {
    setCarregandoLeads(true);
    try {
      const params = new URLSearchParams();
      if (filtros.temperatura) params.set("temperatura", filtros.temperatura);
      if (filtros.origem) params.set("origem", filtros.origem);
      if (filtros.atribuidoA) params.set("atribuido_a", filtros.atribuidoA);
      if (filtros.periodo) {
        const agora = new Date();
        let desde: Date;
        if (filtros.periodo === "mes") desde = new Date(agora.getFullYear(), agora.getMonth(), 1);
        else desde = new Date(agora.getTime() - (filtros.periodo === "7dias" ? 7 : 30) * 24 * 60 * 60 * 1000);
        params.set("criados_a_partir_de", desde.toISOString());
      }

      const response = await fetch(`/api/comercial/leads?${params.toString()}`);
      const payload = await response.json();
      if (payload.success) setLeads(payload.data);
    } finally {
      setCarregandoLeads(false);
    }
  }, [filtros]);

  const carregarLeadsFrios = useCallback(async () => {
    setCarregandoFrios(true);
    try {
      const response = await fetch("/api/comercial/leads-frios");
      const payload = await response.json();
      if (payload.success) setLeadsFrios(payload.data);
    } finally {
      setCarregandoFrios(false);
    }
  }, []);

  useEffect(() => {
    carregarLeads();
  }, [carregarLeads]);

  useEffect(() => {
    if (aba === "crm") carregarLeadsFrios();
  }, [aba, carregarLeadsFrios]);

  useEffect(() => {
    fetch("/api/usuarios")
      .then((r) => r.json())
      .then(setUsuarios)
      .catch(() => setUsuarios([]));
  }, []);

  async function moverLead(leadId: string, novaEtapa: EtapaFunil) {
    const leadAtual = leads.find((l) => l.id === leadId);
    if (!leadAtual || leadAtual.etapa === novaEtapa) return;

    // Fechar uma venda pede o valor fechado antes de mover (migração 043).
    let valorFechado: number | undefined;
    let orcamentosVencedores: number[] | undefined;
    if (novaEtapa === "fechado" && exigeValorFechado(leadAtual)) {
      const informado = await pedirValorFechado(leadAtual);
      if (informado === null) return;
      valorFechado = informado.valor;
      orcamentosVencedores = informado.vencedores;
    }

    // Atualização otimista — o card já pula de coluna antes da resposta do
    // servidor; se falhar, o card volta (refetch) e o erro aparece no toast.
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, etapa: novaEtapa, ...(valorFechado !== undefined && { valor_fechado: valorFechado }) } : l)));

    try {
      const response = await fetch(`/api/comercial/leads/${leadId}/mover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ novaEtapa, valorFechado, orcamentosVencedores }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        toast.erro(payload.error ?? "Não foi possível mover o lead.");
        carregarLeads();
        return;
      }
      toast.sucesso(`Lead movido para ${formatarEtapa(novaEtapa)}.`);
    } catch {
      toast.erro("Erro de conexão ao mover o lead.");
      carregarLeads();
    }
  }

  async function reativarFrio(agendamentoId: string) {
    const response = await fetch(`/api/comercial/leads-frios/${agendamentoId}/reativar`, { method: "POST" });
    const payload = await response.json();
    if (!response.ok || !payload.success) {
      toast.erro(payload.error ?? "Não foi possível reativar o lead.");
      return;
    }
    toast.sucesso("Lead reativado — voltou para Morno/Contato.");
    carregarLeadsFrios();
    carregarLeads();
  }

  async function cancelarFrio(agendamentoId: string) {
    if (!(await confirmar("Cancelar este agendamento de reativação? O lead continua Frio, só sem retorno automático."))) return;
    const response = await fetch(`/api/comercial/leads-frios/${agendamentoId}/cancelar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) {
      toast.erro(payload.error ?? "Não foi possível cancelar o agendamento.");
      return;
    }
    toast.info("Agendamento de reativação cancelado.");
    carregarLeadsFrios();
  }

  // Lead de comissão guarda o valor em `valor_comissao`, não em
  // `valor_estimado` (mesma distinção de components/modules/comercial/
  // KanbanBoard.tsx) — sem isso, esses leads ficavam de fora do total.
  const valorTotalAtivo = leads.filter((l) => l.etapa !== "fechado" && l.etapa !== "perdido").reduce((acc, l) => acc + valorDoLead(l), 0);

  const totalLeadsAtrasados = leads.filter((l) => l.etapa_atrasada).length;
  const totalLeadsComissao = leads.filter((l) => l.eh_comissao).length;
  const totalLeadsPerdidos = leads.filter((l) => l.etapa === "perdido").length;
  const nomesResponsaveis = Object.fromEntries(usuarios.map((u) => [u.email, u.nome]));
  const buscaNormalizada = filtros.busca.trim().toLowerCase();
  const leadsBuscados = buscaNormalizada
    ? leads.filter(
        (l) =>
          l.numero_lead?.toLowerCase().includes(buscaNormalizada) ||
          orcamentosDoLead(l).some(
            (v) => v.orcamento.numero_orcamento?.toLowerCase().includes(buscaNormalizada) || v.orcamento.numero?.toLowerCase().includes(buscaNormalizada)
          ) ||
          l.cliente?.nome?.toLowerCase().includes(buscaNormalizada)
      )
    : leads;
  // Leads frios ficam fora do Kanban normal por padrão — só aparecem via
  // "Mostrar leads frios em reativação" (LeadsFriosPanel) ou escolhendo
  // "Frio" explicitamente no filtro de Temperatura acima. Um lead frio
  // "sumir" do board até seu retorno automático é o comportamento pedido —
  // não é um lead perdido, é um lead com reativação já agendada (ver
  // lib/usecases/comercial/mudarTemperatura.ts).
  const leadsSemFriosOcultos = filtros.temperatura === "frio" ? leadsBuscados : leadsBuscados.filter((l) => l.temperatura !== "frio");
  const leadsAposAtrasados = soAtrasados ? leadsSemFriosOcultos.filter((l) => l.etapa_atrasada) : leadsSemFriosOcultos;
  const leadsAposComissoes = soComissoes ? leadsAposAtrasados.filter((l) => l.eh_comissao) : leadsAposAtrasados;
  const leadsExibidos = !filtroRepresentante
    ? leadsAposComissoes
    : leadsAposComissoes.filter((l) => (filtroRepresentante === "todos" ? Boolean(l.representante_id) : l.representante_id === filtroRepresentante));
  const representantesNoFunil = Object.values(
    leads.reduce<Record<string, { id: string; nome: string; total: number }>>((acc, l) => {
      if (l.representante_id) acc[l.representante_id] = { id: l.representante_id, nome: l.representante?.nome ?? "Representante", total: (acc[l.representante_id]?.total ?? 0) + 1 };
      return acc;
    }, {})
  ).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  // Revisão de usabilidade: abas do módulo primeiro, depois o cabeçalho
  // padrão (título, ação principal e menu "⋯"). A frase fica numa linha
  // discreta, cortada com "..." no celular.
  return (
    <div className="space-y-4">
      <TabsNavigation tabs={ABAS.map((a) => ({ valor: a.valor, label: a.label }))} activeTab={aba} onTabChange={trocarAba} />

      {/* Parcerias e Representantes têm cabeçalho próprio (título e "+ Novo"). */}
      {aba === "parcerias" && <ListaParceiros categoria="parceria" />}
      {aba === "representantes" && <ListaParceiros categoria="representante" />}
      {aba !== "parcerias" && aba !== "representantes" && (
        <CabecalhoPagina
          titulo="Comercial"
          descricao={
            <>
              <span
                className="block truncate text-xs italic text-gray-400"
                title="O próprio SENHOR irá à sua frente e estará com você; ele nunca o deixará nem o abandonará. Não tenha medo! Não desanime!"
              >
                "O próprio SENHOR irá à sua frente e estará com você; ele nunca o deixará nem o abandonará. Não tenha medo! Não desanime!"
              </span>
              {aba === "crm" && `${leads.length} lead${leads.length === 1 ? "" : "s"}, ${formatarMoeda(valorTotalAtivo)} em negociação ativa.`}
              {aba === "clientes" && "Cadastro de clientes e histórico de leads."}
              {aba === "configuracoes" && "Prazos de reativação, prazo máximo por etapa e responsáveis."}
            </>
          }
          acaoPrincipal={aba === "crm" ? { label: "+ Novo Lead", onClick: () => setMostrarNovoLead(true) } : undefined}
          // Lixeira (migração 047): leads excluídos, recuperáveis por 30 dias — só administrador.
          acoes={aba === "crm" && acesso?.admin ? [{ label: "Lixeira", onClick: () => setMostrarLixeira(true) }] : []}
        />
      )}
      {mostrarLixeira && (
        <Lixeira
          tipo="leads"
          onFechar={() => setMostrarLixeira(false)}
          onRestaurado={() => {
            carregarLeads();
            carregarLeadsFrios();
          }}
        />
      )}

      {aba === "crm" && (
        <div className="space-y-4">
          <FiltrosKanban
            filtros={filtros}
            onChange={(patch) => setFiltros((prev) => ({ ...prev, ...patch }))}
            usuarios={usuarios}
            mostrarFrios={mostrarFrios}
            onToggleFrios={setMostrarFrios}
            totalLeadsFrios={leadsFrios.length}
            soAtrasados={soAtrasados}
            onToggleAtrasados={setSoAtrasados}
            totalLeadsAtrasados={totalLeadsAtrasados}
            soComissoes={soComissoes}
            onToggleComissoes={setSoComissoes}
            totalLeadsComissao={totalLeadsComissao}
            representante={filtroRepresentante}
            onRepresentante={setFiltroRepresentante}
            representantes={representantesNoFunil}
            mostrarPerdidos={mostrarPerdidos}
            onTogglePerdidos={setMostrarPerdidos}
            totalLeadsPerdidos={totalLeadsPerdidos}
          />

          {mostrarFrios ? (
            <LeadsFriosPanel agendamentos={leadsFrios} carregando={carregandoFrios} onReativar={reativarFrio} onCancelar={cancelarFrio} />
          ) : carregandoLeads ? (
            <EsqueletoLista />
          ) : (
            <KanbanBoard
              leads={leadsExibidos}
              onAbrirLead={(lead) => router.push(`/comercial/leads/${lead.id}`)}
              onMoverLead={moverLead}
              nomesResponsaveis={nomesResponsaveis}
              mostrarPerdidos={mostrarPerdidos}
            />
          )}
        </div>
      )}

      {aba === "clientes" && <ClientesTab />}
      {aba === "configuracoes" && <ConfiguracoesTab />}

      <ValorFechadoHost />

      {mostrarNovoLead && (
        <NovoLeadModal
          onFechar={() => setMostrarNovoLead(false)}
          onCriado={(leadId) => {
            setMostrarNovoLead(false);
            carregarLeads();
            // Lead de comissão (migração 026): não dá pra anexar o
            // comprovante durante a criação (upload exige um lead com id já
            // existente, ver AnexosLead.tsx) — abre o detalhe direto em
            // seguida, já que o próximo passo natural é adicionar o anexo.
            if (leadId) {
              toast.sucesso("Lead de parceria criado — adicione o comprovante (anexo) a seguir.");
              router.push(`/comercial/leads/${leadId}`);
            } else {
              toast.sucesso("Lead criado.");
            }
          }}
        />
      )}
    </div>
  );
}
