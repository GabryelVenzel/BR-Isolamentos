"use client";

import { EsqueletoLista } from "@/components/ui/Esqueleto";
import { useCallback, useEffect, useState } from "react";
import TableOrcamentos from "@/components/TableOrcamentos";
import type { Orcamento, StatusOrcamento } from "@/lib/types";
import { confirmar } from "@/components/ui/confirmar";
import Lixeira from "@/components/Lixeira";
import CabecalhoPagina from "@/components/ui/CabecalhoPagina";
import PainelFiltros from "@/components/ui/PainelFiltros";
import { useAcesso } from "@/lib/hooks/useAcesso";
import { useEstadoLembrado } from "@/lib/hooks/useEstadoLembrado";
import { formatarData } from "@/lib/format";

const STATUS_OPCOES: Array<{ value: StatusOrcamento | ""; label: string }> = [
  { value: "", label: "Todos os status" },
  { value: "rascunho", label: "Rascunho" },
  { value: "proposta", label: "Proposta" },
  { value: "enviado", label: "Enviado" },
  { value: "aceito", label: "Aceito" },
  { value: "rejeitado", label: "Rejeitado" },
];

export default function HistoricoPage() {
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  // Filtros lembrados entre visitas (revisão de usabilidade).
  const [filtros, setFiltros] = useEstadoLembrado("filtros-historico", { status: "", dataInicio: "", dataFim: "" });
  const { status, dataInicio, dataFim } = filtros;
  const filtrar = (campo: keyof typeof filtros, valor: string) => setFiltros((f) => ({ ...f, [campo]: valor }));
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (dataInicio) params.set("data_inicio", dataInicio);
    if (dataFim) params.set("data_fim", dataFim);

    const response = await fetch(`/api/orcamentos?${params.toString()}`);
    if (response.ok) {
      const data: Orcamento[] = await response.json();
      const buscaNormalizada = busca.trim().toLowerCase();
      const filtrados = buscaNormalizada
        ? data.filter(
            (o) =>
              o.cliente?.nome?.toLowerCase().includes(buscaNormalizada) ||
              o.numero?.toLowerCase().includes(buscaNormalizada) ||
              o.numero_orcamento?.toLowerCase().includes(buscaNormalizada)
          )
        : data;
      setOrcamentos(filtrados);
    }
    setCarregando(false);
  }, [status, dataInicio, dataFim, busca]);

  useEffect(() => {
    const timeout = setTimeout(carregar, 250);
    return () => clearTimeout(timeout);
  }, [carregar]);

  const [mostrarLixeira, setMostrarLixeira] = useState(false);
  const { acesso } = useAcesso();

  async function excluir(id: number) {
    const seguir = await confirmar(
      "Excluir este orçamento? Ele sai das telas e vai para a lixeira. Um administrador pode restaurar por 30 dias; depois disso é removido de vez.",
      { titulo: "Excluir orçamento", confirmarLabel: "Enviar para a lixeira" }
    );
    if (!seguir) return;
    const response = await fetch(`/api/orcamentos/${id}`, { method: "DELETE" });
    if (response.ok) {
      setOrcamentos((prev) => prev.filter((o) => o.id !== id));
    }
  }

  const ativos = [
    ...(status ? [{ label: STATUS_OPCOES.find((s) => s.value === status)?.label ?? status, limpar: () => filtrar("status", "") }] : []),
    ...(dataInicio ? [{ label: `De ${formatarData(dataInicio)}`, limpar: () => filtrar("dataInicio", "") }] : []),
    ...(dataFim ? [{ label: `Até ${formatarData(dataFim)}`, limpar: () => filtrar("dataFim", "") }] : []),
  ];

  return (
    <div className="space-y-4">
      <CabecalhoPagina
        titulo="Histórico de Orçamentos"
        descricao={carregando ? "Consulte, filtre e gerencie todos os orçamentos." : `${orcamentos.length} orçamento${orcamentos.length === 1 ? "" : "s"} — clique em um para abrir.`}
        acaoPrincipal={{ label: "+ Novo Orçamento", href: "/novo-orcamento" }}
        // Lixeira (migração 047): orçamentos excluídos, recuperáveis por 30 dias — só administrador.
        acoes={acesso?.admin ? [{ label: "Lixeira", onClick: () => setMostrarLixeira(true) }] : []}
      />
      {mostrarLixeira && <Lixeira tipo="orcamentos" onFechar={() => setMostrarLixeira(false)} onRestaurado={carregar} />}

      <PainelFiltros
        ativos={ativos}
        busca={
          <input
            aria-label="Buscar orçamento"
            className="input-field"
            placeholder="Código (O00001, ORC-2026-0001) ou nome do cliente..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <select aria-label="Status" className="input-field" value={status} onChange={(e) => filtrar("status", e.target.value)}>
            {STATUS_OPCOES.map((opcao) => (
              <option key={opcao.value} value={opcao.value}>
                {opcao.label}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-gray-500">
            <span className="shrink-0">De</span>
            <input type="date" className="input-field" value={dataInicio} onChange={(e) => filtrar("dataInicio", e.target.value)} />
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-500">
            <span className="shrink-0">Até</span>
            <input type="date" className="input-field" value={dataFim} onChange={(e) => filtrar("dataFim", e.target.value)} />
          </label>
        </div>
      </PainelFiltros>

      {carregando ? <EsqueletoLista linhas={8} /> : <TableOrcamentos orcamentos={orcamentos} onExcluir={excluir} />}
    </div>
  );
}
