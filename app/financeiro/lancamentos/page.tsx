"use client";

import { useCallback, useEffect, useState } from "react";
import ToastContainer from "@/components/modules/financeiro/ToastContainer";
import { toast } from "@/components/modules/financeiro/toast";
import ModalLancamento from "@/components/modules/financeiro/ModalLancamento";
import { formatarData, formatarMoeda } from "@/lib/format";
import type { CategoriaLancamento, LancamentoFinanceiro } from "@/lib/types/domain";

export default function LancamentosPage() {
  const [lancamentos, setLancamentos] = useState<LancamentoFinanceiro[]>([]);
  const [categorias, setCategorias] = useState<CategoriaLancamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");

  const [editando, setEditando] = useState<LancamentoFinanceiro | "novo" | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const params = new URLSearchParams();
      if (filtroTipo) params.set("tipo", filtroTipo);
      if (filtroCategoria) params.set("categoria", filtroCategoria);
      if (filtroStatus) params.set("pago", filtroStatus === "pago" ? "true" : "false");

      const response = await fetch(`/api/financeiro/lancamentos?${params.toString()}`);
      const payload = await response.json();
      if (payload.success) setLancamentos(payload.data);
    } finally {
      setCarregando(false);
    }
  }, [filtroTipo, filtroCategoria, filtroStatus]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    fetch("/api/financeiro/categorias")
      .then((r) => r.json())
      .then((p) => p.success && setCategorias(p.data));
  }, []);

  async function marcarPago(id: string) {
    const response = await fetch(`/api/financeiro/lancamentos/${id}/pagar`, { method: "POST" });
    const payload = await response.json();
    if (payload.success) {
      toast.sucesso("Lançamento marcado como pago.");
      setLancamentos((prev) => prev.map((l) => (l.id === id ? payload.data : l)));
    } else {
      toast.erro(payload.error ?? "Não foi possível marcar como pago.");
    }
  }

  async function excluir(lancamento: LancamentoFinanceiro) {
    if (!confirm(`Excluir o lançamento "${lancamento.descricao}"?`)) return;
    const response = await fetch(`/api/financeiro/lancamentos/${lancamento.id}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok || !data.success) {
      toast.erro(data.error ?? "Não foi possível excluir o lançamento.");
      return;
    }
    toast.sucesso("Lançamento excluído.");
    carregar();
  }

  const lancamentosFiltrados = busca
    ? lancamentos.filter((l) => l.descricao.toLowerCase().includes(busca.toLowerCase()))
    : lancamentos;

  return (
    <div className="space-y-6">
      <ToastContainer />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Lançamentos</h1>
          <p className="text-sm text-gray-500">
            {lancamentos.length} lançamento{lancamentos.length === 1 ? "" : "s"} no período.
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setEditando("novo")}>
          + Novo Lançamento
        </button>
      </div>

      <div className="card grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <input className="input-field" placeholder="Buscar por descrição..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        <select className="input-field" value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
          <option value="">Todos os tipos</option>
          <option value="receita">Receita</option>
          <option value="despesa">Despesa</option>
        </select>
        <select className="input-field" value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)}>
          <option value="">Todas as categorias</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.nome}>
              {c.nome}
            </option>
          ))}
        </select>
        <select className="input-field" value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
          <option value="">Todas as situações</option>
          <option value="pago">Pago/Recebido</option>
          <option value="pendente">Pendente</option>
        </select>
      </div>

      {carregando ? (
        <p className="text-sm text-gray-500">Carregando...</p>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-2 text-left">Data</th>
                <th className="px-4 py-2 text-left">Tipo</th>
                <th className="px-4 py-2 text-left">Categoria</th>
                <th className="px-4 py-2 text-left">Descrição</th>
                <th className="px-4 py-2 text-right">Valor</th>
                <th className="px-4 py-2 text-left">Situação</th>
                <th className="px-4 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lancamentosFiltrados.map((lancamento) => (
                <tr key={lancamento.id}>
                  <td className="px-4 py-2">{formatarData(lancamento.data)}</td>
                  <td className="px-4 py-2">
                    <span className={`badge ${lancamento.tipo === "receita" ? "bg-accent-light text-accent-dark" : "bg-red-100 text-status-error"}`}>
                      {lancamento.tipo === "receita" ? "Receita" : "Despesa"}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-500">{lancamento.categoria}</td>
                  <td className="px-4 py-2">{lancamento.descricao}</td>
                  <td className={`px-4 py-2 text-right font-medium ${lancamento.tipo === "receita" ? "text-accent" : "text-status-error"}`}>
                    {lancamento.tipo === "despesa" && "- "}
                    {formatarMoeda(lancamento.valor)}
                  </td>
                  <td className="px-4 py-2">
                    {lancamento.pago ? (
                      <span className="badge bg-accent-light text-accent-dark">Pago</span>
                    ) : (
                      <button type="button" className="badge bg-secondary-light text-brand" onClick={() => marcarPago(lancamento.id)}>
                        Marcar como pago
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {/* `?? []` — se a migração 009 (coluna `anexos`) ainda não
                        rodou nesse banco, o campo vem `undefined` da API, não
                        um array vazio; sem essa guarda, `.length` quebrava a
                        tela inteira ("Cannot read properties of undefined"). */}
                    {(lancamento.anexos ?? []).length > 0 && (
                      <span className="mr-2 text-xs text-gray-500" title={`${(lancamento.anexos ?? []).length} anexo(s)`}>
                        📎 {(lancamento.anexos ?? []).length}
                      </span>
                    )}
                    <button type="button" className="mr-2 hover:opacity-70" title="Editar" onClick={() => setEditando(lancamento)}>
                      ✏️
                    </button>
                    <button type="button" className="hover:opacity-70" title="Excluir" onClick={() => excluir(lancamento)}>
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
              {lancamentosFiltrados.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-gray-400">
                    Nenhum lançamento registrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {editando && (
        <ModalLancamento
          lancamento={editando === "novo" ? null : editando}
          onFechar={() => setEditando(null)}
          onSalvo={() => {
            setEditando(null);
            carregar();
          }}
        />
      )}
    </div>
  );
}
