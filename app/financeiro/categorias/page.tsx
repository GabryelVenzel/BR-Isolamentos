"use client";

import { useCallback, useEffect, useState } from "react";
import ToastContainer from "@/components/modules/financeiro/ToastContainer";
import { toast } from "@/components/modules/financeiro/toast";
import ModalCategoria from "@/components/modules/financeiro/ModalCategoria";
import type { CategoriaLancamento } from "@/lib/types/domain";

export default function CategoriasPage() {
  const [categorias, setCategorias] = useState<CategoriaLancamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [editando, setEditando] = useState<CategoriaLancamento | "novo" | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const response = await fetch("/api/financeiro/categorias");
      const payload = await response.json();
      if (payload.success) setCategorias(payload.data);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function excluir(categoria: CategoriaLancamento) {
    if (!confirm(`Excluir a categoria "${categoria.nome}"?`)) return;
    const response = await fetch(`/api/financeiro/categorias/${categoria.id}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok || !data.success) {
      toast.erro(data.error ?? "Não foi possível excluir a categoria.");
      return;
    }
    toast.sucesso("Categoria excluída.");
    carregar();
  }

  async function alternarAtivo(categoria: CategoriaLancamento) {
    const response = await fetch(`/api/financeiro/categorias/${categoria.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: !categoria.ativo }),
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      toast.erro(data.error ?? "Não foi possível atualizar a categoria.");
      return;
    }
    carregar();
  }

  return (
    <div className="space-y-6">
      <ToastContainer />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Categorias</h1>
          <p className="text-sm text-gray-500">Gerenciar categorias de lançamentos de forma centralizada.</p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setEditando("novo")}>
          + Nova Categoria
        </button>
      </div>

      {carregando ? (
        <p className="text-sm text-gray-500">Carregando...</p>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-2 text-left">Nome</th>
                <th className="px-4 py-2 text-left">Descrição</th>
                <th className="px-4 py-2 text-left">Tipo</th>
                <th className="px-4 py-2 text-left">Ativo</th>
                <th className="px-4 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {categorias.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-2 font-medium text-brand">{c.nome}</td>
                  <td className="px-4 py-2 text-gray-500">{c.descricao ?? "—"}</td>
                  <td className="px-4 py-2">
                    <span className={`badge ${c.tipo === "receita" ? "bg-accent-light text-accent-dark" : "bg-red-100 text-status-error"}`}>
                      {c.tipo === "receita" ? "Receita" : "Despesa"}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <button
                      type="button"
                      className={`badge ${c.ativo ? "bg-accent-light text-accent-dark" : "bg-gray-100 text-gray-500"}`}
                      onClick={() => alternarAtivo(c)}
                    >
                      {c.ativo ? "Ativo" : "Inativo"}
                    </button>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button type="button" className="mr-2 hover:opacity-70" title="Editar" onClick={() => setEditando(c)}>
                      ✏️
                    </button>
                    <button
                      type="button"
                      className="hover:opacity-70 disabled:cursor-not-allowed disabled:opacity-30"
                      title={c.protegida ? "Categoria pré-definida — só desativar" : "Excluir"}
                      disabled={c.protegida}
                      onClick={() => excluir(c)}
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
              {categorias.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                    Nenhuma categoria cadastrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {editando && (
        <ModalCategoria
          categoria={editando === "novo" ? null : editando}
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
