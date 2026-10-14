"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { toast } from "@/components/modules/operacional/toast";
import KanbanServicos from "@/components/modules/operacional/KanbanServicos";
import { useRouter, useSearchParams } from "next/navigation";
import CabecalhoPagina from "@/components/ui/CabecalhoPagina";
import PainelFiltros from "@/components/ui/PainelFiltros";
import { EsqueletoLista } from "@/components/ui/Esqueleto";
import { useEstadoLembrado } from "@/lib/hooks/useEstadoLembrado";
import NovoServicoModal from "@/components/modules/operacional/NovoServicoModal";
import Lixeira from "@/components/Lixeira";
import { useAcesso } from "@/lib/hooks/useAcesso";
import { TIPOS_TRABALHO_OPCOES } from "@/components/modules/operacional/MultiSelectTiposTrabalho";
import type { EtapaServico, Servico } from "@/lib/types/domain";

// Lista revisada (migração 027) — reaproveita a mesma fonte de sempre, ver
// MultiSelectTiposTrabalho.tsx.
const LABEL_TIPO: Record<string, string> = Object.fromEntries(TIPOS_TRABALHO_OPCOES.map((o) => [o.valor, o.label]));

export default function ServicosPage() {
  return (
    <Suspense fallback={<EsqueletoLista />}>
      <Servicos />
    </Suspense>
  );
}

function Servicos() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [carregando, setCarregando] = useState(true);
  // Filtros lembrados entre visitas (revisão de usabilidade).
  const [filtros, setFiltros] = useEstadoLembrado("filtros-servicos", { busca: "", tipo: "", responsavel: "" });
  const { busca, tipo: filtroTipo, responsavel: filtroResponsavel } = filtros;
  const setBusca = (busca: string) => setFiltros((f) => ({ ...f, busca }));
  const setFiltroTipo = (tipo: string) => setFiltros((f) => ({ ...f, tipo }));
  const setFiltroResponsavel = (responsavel: string) => setFiltros((f) => ({ ...f, responsavel }));
  const [usuarios, setUsuarios] = useState<Array<{ email: string; nome: string }>>([]);

  const [mostrarNovo, setMostrarNovo] = useState(false);
  const [mostrarLixeira, setMostrarLixeira] = useState(false);
  const { acesso } = useAcesso();

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

  // "+ Criar → Novo serviço" do cabeçalho.
  useEffect(() => {
    if (searchParams.get("novo")) setMostrarNovo(true);
  }, [searchParams]);

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

  const abrir = (id: string) => router.push(`/operacional/servicos/${id}`);
  const nomeResponsavel = usuarios.find((u) => u.email === filtroResponsavel)?.nome ?? filtroResponsavel;

  return (
    <div className="space-y-4">
      <CabecalhoPagina
        titulo="Serviços"
        descricao={`${servicos.length} serviço${servicos.length === 1 ? "" : "s"} no funil de obras.`}
        acaoPrincipal={{ label: "+ Novo Serviço", onClick: () => setMostrarNovo(true) }}
        // Lixeira (migração 045): serviços excluídos, recuperáveis por 30 dias — só administrador.
        acoes={acesso?.admin ? [{ label: "Lixeira", onClick: () => setMostrarLixeira(true) }] : []}
      />

      <PainelFiltros
        busca={<input className="input-field" placeholder="Buscar por código ou cliente..." value={busca} onChange={(e) => setBusca(e.target.value)} />}
        ativos={[
          ...(filtroTipo ? [{ label: LABEL_TIPO[filtroTipo] ?? filtroTipo, limpar: () => setFiltroTipo("") }] : []),
          ...(filtroResponsavel ? [{ label: nomeResponsavel, limpar: () => setFiltroResponsavel("") }] : []),
        ]}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <select className="input-field" aria-label="Tipo de trabalho" value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
            <option value="">Todos os tipos</option>
            {Object.entries(LABEL_TIPO).map(([valor, label]) => (
              <option key={valor} value={valor}>
                {label}
              </option>
            ))}
          </select>
          <select className="input-field" aria-label="Responsável" value={filtroResponsavel} onChange={(e) => setFiltroResponsavel(e.target.value)}>
            <option value="">Todos os responsáveis</option>
            {usuarios.map((u) => (
              <option key={u.email} value={u.email}>
                {u.nome}
              </option>
            ))}
          </select>
        </div>
      </PainelFiltros>

      {carregando ? (
        <EsqueletoLista />
      ) : (
        <KanbanServicos
          servicos={servicosFiltrados}
          onAbrirServico={(s) => abrir(s.id)}
          onMoverServico={moverServico}
          onSoltarEmFinalizado={(servicoId) => {
            toast.info("Pra finalizar, confirme o checklist de documentação (foto, PDF e valor real).");
            abrir(servicoId);
          }}
        />
      )}

      {mostrarLixeira && <Lixeira tipo="servicos" onFechar={() => setMostrarLixeira(false)} onRestaurado={carregar} />}

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
