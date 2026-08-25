"use client";

import { useCallback, useEffect, useState } from "react";
import ToastContainer from "@/components/modules/operacional/ToastContainer";
import { toast } from "@/components/modules/operacional/toast";
import ModalParceiro from "@/components/modules/operacional/ModalParceiro";
import { formatarNumero } from "@/lib/format";
import type { Parceiro } from "@/lib/types/domain";

const LABEL_TIPO: Record<string, string> = {
  bancada: "Bancada",
  caldeiraria: "Caldeiraria",
  isolamentos_removiveis: "Isolamentos Removíveis",
  isolamentos_fixos: "Isolamentos Fixos",
};

/** Cadastro de parceiros de instalação — capacidade "mobilizadas/
 * disponíveis" (colunas do mockup) não é mostrada nesta tabela porque é
 * relativa a um DIA específico (ver aba Capacidade, que tem essa
 * granularidade); aqui só a capacidade TOTAL cadastrada é exibida. */
export default function ParceirosPage() {
  const [parceiros, setParceiros] = useState<Parceiro[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState<Parceiro | "novo" | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const response = await fetch("/api/operacional/parceiros");
      const payload = await response.json();
      if (payload.success) setParceiros(payload.data);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function excluir(parceiro: Parceiro) {
    if (!confirm(`Excluir o parceiro "${parceiro.nome}"?`)) return;
    const response = await fetch(`/api/operacional/parceiros/${parceiro.id}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok || !data.success) {
      toast.erro(
        data.error ??
          "Não foi possível excluir o parceiro — verifique se ele não tem serviços vinculados."
      );
      return;
    }
    toast.sucesso("Parceiro excluído.");
    carregar();
  }

  const parceirosFiltrados = busca
    ? parceiros.filter((p) => p.nome.toLowerCase().includes(busca.toLowerCase()))
    : parceiros;

  return (
    <div className="space-y-6">
      <ToastContainer />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Parceiros</h1>
          <p className="text-sm text-gray-500">Cadastro de mão de obra parceira para instalação.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <input className="input-field max-w-xs" placeholder="Buscar parceiro..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        <button type="button" className="btn-primary" onClick={() => setEditando("novo")}>
          + Novo Parceiro
        </button>
      </div>

      {carregando ? (
        <p className="text-sm text-gray-500">Carregando...</p>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-2 text-left">Código</th>
                <th className="px-4 py-2 text-left">Nome</th>
                <th className="px-4 py-2 text-left">Telefone</th>
                <th className="px-4 py-2 text-left">CNPJ</th>
                <th className="px-4 py-2 text-left">Trabalhos</th>
                <th className="px-4 py-2 text-right">Capacidade</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {parceirosFiltrados.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2 font-mono text-xs text-gray-500">{p.numero_parceiro ?? "—"}</td>
                  <td className="px-4 py-2 font-medium text-brand">{p.nome}</td>
                  <td className="px-4 py-2 text-gray-500">{p.telefone ?? "—"}</td>
                  <td className="px-4 py-2 text-gray-500">{p.cnpj ?? "—"}</td>
                  <td className="px-4 py-2 text-gray-500">
                    {(p.tipos_trabalho ?? []).length > 0 ? p.tipos_trabalho.map((t) => LABEL_TIPO[t] ?? t).join(", ") : "—"}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-500">
                    {p.total_pessoas != null ? `${formatarNumero(p.total_pessoas, 0)} pessoas` : "—"}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`badge ${p.ativo ? "bg-accent-light text-accent-dark" : "bg-gray-100 text-gray-500"}`}>
                      {p.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button type="button" className="mr-2 hover:opacity-70" title="Editar" onClick={() => setEditando(p)}>
                      ✏️
                    </button>
                    <button type="button" className="hover:opacity-70" title="Excluir" onClick={() => excluir(p)}>
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
              {parceirosFiltrados.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-gray-400">
                    Nenhum parceiro cadastrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {editando && (
        <ModalParceiro
          parceiro={editando === "novo" ? null : editando}
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
