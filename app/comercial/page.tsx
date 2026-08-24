"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import ToastContainer from "@/components/modules/comercial/ToastContainer";
import { toast } from "@/components/modules/comercial/toast";
import KanbanBoard from "@/components/modules/comercial/KanbanBoard";
import FiltrosKanban, { type FiltrosKanbanState } from "@/components/modules/comercial/FiltrosKanban";
import LeadsFriosPanel from "@/components/modules/comercial/LeadsFriosPanel";
import LeadDetailModal from "@/components/modules/comercial/LeadDetailModal";
import ClientesTab from "@/components/modules/comercial/ClientesTab";
import ConfiguracoesTab from "@/components/modules/comercial/ConfiguracoesTab";
import NovoLeadModal from "@/components/comercial/NovoLeadModal";
import { formatarEtapa, formatarMoeda } from "@/lib/format";
import type { AgendamentoLeadFrio, EtapaFunil, Lead } from "@/lib/types/domain";

// A aba "Relatórios" que existia aqui foi removida — os relatórios
// comerciais (funil, origem, performance por responsável etc.) agora vivem
// centralizados em /resumo?tab=comercial, junto com os relatórios de
// Operacional e Financeiro (ver app/resumo/page.tsx).
type AbaComercial = "crm" | "clientes" | "configuracoes";

const ABAS: Array<{ valor: AbaComercial; label: string }> = [
  { valor: "crm", label: "CRM" },
  { valor: "clientes", label: "Clientes" },
  { valor: "configuracoes", label: "Configurações" },
];

const CHAVE_ABA = "br-isolamentos:comercial-aba";
const FILTROS_INICIAIS: FiltrosKanbanState = { temperatura: "", origem: "", atribuidoA: "", periodo: "" };

export default function ComercialPage() {
  return (
    <Suspense fallback={null}>
      <ComercialPageConteudo />
    </Suspense>
  );
}

function ComercialPageConteudo() {
  const searchParams = useSearchParams();

  const [aba, setAba] = useState<AbaComercial>("crm");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [carregandoLeads, setCarregandoLeads] = useState(true);
  const [filtros, setFiltros] = useState<FiltrosKanbanState>(FILTROS_INICIAIS);
  const [usuarios, setUsuarios] = useState<Array<{ email: string; nome: string }>>([]);

  const [mostrarFrios, setMostrarFrios] = useState(false);
  const [leadsFrios, setLeadsFrios] = useState<AgendamentoLeadFrio[]>([]);
  const [carregandoFrios, setCarregandoFrios] = useState(false);

  const [soAtrasados, setSoAtrasados] = useState(false);

  const [leadSelecionadoId, setLeadSelecionadoId] = useState<string | null>(null);
  const [mostrarNovoLead, setMostrarNovoLead] = useState(false);

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

  // `?lead=<id>` abre o modal de detalhe automaticamente — usado pelo
  // redirect de /comercial/[id] (rota antiga) e por links diretos.
  useEffect(() => {
    const leadParam = searchParams.get("lead");
    if (leadParam) setLeadSelecionadoId(leadParam);
  }, [searchParams]);

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
    fetch("/api/usuarios").then((r) => r.json()).then(setUsuarios).catch(() => setUsuarios([]));
  }, []);

  async function moverLead(leadId: string, novaEtapa: EtapaFunil) {
    const leadAtual = leads.find((l) => l.id === leadId);
    if (!leadAtual || leadAtual.etapa === novaEtapa) return;

    // Atualização otimista — o card já pula de coluna antes da resposta do
    // servidor; se falhar, o card volta (refetch) e o erro aparece no toast.
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, etapa: novaEtapa } : l)));

    try {
      const response = await fetch(`/api/comercial/leads/${leadId}/mover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ novaEtapa }),
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
    if (!confirm("Cancelar este agendamento de reativação? O lead continua Frio, só sem retorno automático.")) return;
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

  const valorTotalAtivo = leads
    .filter((l) => l.etapa !== "fechado" && l.etapa !== "perdido")
    .reduce((acc, l) => acc + l.valor_estimado, 0);

  const totalLeadsAtrasados = leads.filter((l) => l.etapa_atrasada).length;
  const leadsExibidos = soAtrasados ? leads.filter((l) => l.etapa_atrasada) : leads;

  return (
    <div className="space-y-6">
      <ToastContainer />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Comercial</h1>
          <p className="text-sm text-gray-500">
            {aba === "crm" && `${leads.length} lead${leads.length === 1 ? "" : "s"}, ${formatarMoeda(valorTotalAtivo)} em negociação ativa.`}
            {aba === "clientes" && "Cadastro de clientes e histórico de leads."}
            {aba === "configuracoes" && "Prazos de reativação, prazo máximo por etapa e responsáveis."}
          </p>
        </div>
        {aba === "crm" && (
          <button type="button" className="btn-primary" onClick={() => setMostrarNovoLead(true)}>
            + Novo Lead
          </button>
        )}
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {ABAS.map((a) => (
          <button
            key={a.valor}
            type="button"
            onClick={() => trocarAba(a.valor)}
            className={`rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
              aba === a.valor ? "border-b-2 border-brand bg-brand-light text-brand" : "text-gray-500 hover:bg-gray-50"
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>

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
          />

          {mostrarFrios ? (
            <LeadsFriosPanel
              agendamentos={leadsFrios}
              carregando={carregandoFrios}
              onReativar={reativarFrio}
              onCancelar={cancelarFrio}
            />
          ) : carregandoLeads ? (
            <p className="text-sm text-gray-500">Carregando...</p>
          ) : (
            <KanbanBoard leads={leadsExibidos} onAbrirLead={(lead) => setLeadSelecionadoId(lead.id)} onMoverLead={moverLead} />
          )}
        </div>
      )}

      {aba === "clientes" && <ClientesTab />}
      {aba === "configuracoes" && <ConfiguracoesTab />}

      {leadSelecionadoId && (
        <LeadDetailModal
          leadId={leadSelecionadoId}
          onFechar={() => setLeadSelecionadoId(null)}
          onLeadMudou={() => {
            carregarLeads();
            carregarLeadsFrios();
          }}
        />
      )}

      {mostrarNovoLead && (
        <NovoLeadModal
          onFechar={() => setMostrarNovoLead(false)}
          onCriado={() => {
            setMostrarNovoLead(false);
            toast.sucesso("Lead criado.");
            carregarLeads();
          }}
        />
      )}
    </div>
  );
}
