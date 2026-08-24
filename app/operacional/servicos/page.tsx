"use client";

import { useCallback, useEffect, useState } from "react";
import ToastContainer from "@/components/modules/operacional/ToastContainer";
import { toast } from "@/components/modules/operacional/toast";
import KanbanServicos from "@/components/modules/operacional/KanbanServicos";
import ServicoDetailModal from "@/components/modules/operacional/ServicoDetailModal";
import NovoServicoModal from "@/components/modules/operacional/NovoServicoModal";
import type { EtapaServico, Servico } from "@/lib/types/domain";

const LABEL_TIPO: Record<string, string> = {
  bancada: "Bancada",
  caldeiraria: "Caldeiraria",
  isolamentos_removiveis: "Isolamentos Removíveis",
  isolamentos_fixos: "Isolamentos Fixos",
};

export default function ServicosPage() {
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroResponsavel, setFiltroResponsavel] = useState("");
  const [usuarios, setUsuarios] = useState<Array<{ email: string; nome: string }>>([]);

  const [servicoSelecionadoId, setServicoSelecionadoId] = useState<string | null>(null);
  const [mostrarNovo, setMostrarNovo] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const params = new URLSearchParams();
      if (filtroTipo) params.set("tipo_trabalho", filtroTipo);
      if (filtroResponsavel) params.set("responsavel_email", filtroResponsavel);

      const response = await fetch(`/api/operacional/servicos?${params.toString()}`);
      const payload = await response.json();
      if (payload.success) setServicos(payload.data);
    } finally {
      setCarregando(false);
    }
  }, [filtroTipo, filtroResponsavel]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    fetch("/api/usuarios").then((r) => r.json()).then(setUsuarios).catch(() => setUsuarios([]));
  }, []);

  async function moverServico(servicoId: string, novaEtapa: EtapaServico) {
    const atual = servicos.find((s) => s.id === servicoId);
    if (!atual || atual.etapa === novaEtapa) return;

    setServicos((prev) => prev.map((s) => (s.id === servicoId ? { ...s, etapa: novaEtapa } : s)));

    try {
      const response = await fetch(`/api/operacional/servicos/${servicoId}/mover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ novaEtapa }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        toast.erro(payload.error ?? "Não foi possível mover o serviço.");
        carregar();
        return;
      }
      toast.sucesso(`Serviço movido para ${novaEtapa === "planejamento" ? "Planejamento" : "Execução"}.`);
    } catch {
      toast.erro("Erro de conexão ao mover o serviço.");
      carregar();
    }
  }

  const servicosFiltrados = busca
    ? servicos.filter(
        (s) =>
          s.numero_servico.toLowerCase().includes(busca.toLowerCase()) ||
          s.cliente?.nome?.toLowerCase().includes(busca.toLowerCase())
      )
    : servicos;

  return (
    <div className="space-y-6">
      <ToastContainer />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Serviços</h1>
          <p className="text-sm text-gray-500">{servicos.length} serviço{servicos.length === 1 ? "" : "s"} no funil de obras.</p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setMostrarNovo(true)}>
          + Novo Serviço
        </button>
      </div>

      <div className="card grid grid-cols-1 gap-3 sm:grid-cols-3">
        <input className="input-field" placeholder="Buscar por código ou cliente..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        <select className="input-field" value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
          <option value="">Todos os tipos</option>
          {Object.entries(LABEL_TIPO).map(([valor, label]) => (
            <option key={valor} value={valor}>
              {label}
            </option>
          ))}
        </select>
        <select className="input-field" value={filtroResponsavel} onChange={(e) => setFiltroResponsavel(e.target.value)}>
          <option value="">Todos os responsáveis</option>
          {usuarios.map((u) => (
            <option key={u.email} value={u.email}>
              {u.nome}
            </option>
          ))}
        </select>
      </div>

      {carregando ? (
        <p className="text-sm text-gray-500">Carregando...</p>
      ) : (
        <KanbanServicos
          servicos={servicosFiltrados}
          onAbrirServico={(s) => setServicoSelecionadoId(s.id)}
          onMoverServico={moverServico}
          onSoltarEmFinalizado={(servicoId) => {
            toast.info("Pra finalizar, confirme o checklist de documentação (foto, PDF e valor real).");
            setServicoSelecionadoId(servicoId);
          }}
        />
      )}

      {servicoSelecionadoId && (
        <ServicoDetailModal
          servicoId={servicoSelecionadoId}
          onFechar={() => setServicoSelecionadoId(null)}
          onServicoMudou={carregar}
        />
      )}

      {mostrarNovo && (
        <NovoServicoModal
          onFechar={() => setMostrarNovo(false)}
          onCriado={() => {
            setMostrarNovo(false);
            carregar();
          }}
        />
      )}
    </div>
  );
}
