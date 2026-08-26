"use client";

import { useCallback, useEffect, useState } from "react";
import ToastContainer from "@/components/modules/operacional/ToastContainer";
import { toast } from "@/components/modules/operacional/toast";
import ModalFornecedor from "@/components/modules/operacional/ModalFornecedor";
import type { Fornecedor } from "@/lib/types/domain";

const LABEL_TIPO: Record<string, string> = {
  materiais: "Materiais",
  equipamentos: "Equipamentos",
  servicos: "Serviços",
};

const LABEL_ESPECIALIDADE: Record<string, string> = {
  isolantes: "Isolantes",
  chaparia: "Chaparia",
  ferramentas: "Ferramentas",
  ferragens: "Ferragens",
  outros: "Outros",
};

export default function FornecedoresPage() {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState<Fornecedor | "novo" | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const params = new URLSearchParams();
      if (busca) params.set("busca", busca);
      const response = await fetch(`/api/operacional/fornecedores?${params.toString()}`);
      const payload = await response.json();
      if (payload.success) setFornecedores(payload.data);
    } finally {
      setCarregando(false);
    }
  }, [busca]);

  useEffect(() => {
    const timeout = setTimeout(carregar, 300);
    return () => clearTimeout(timeout);
  }, [carregar]);

  async function excluir(fornecedor: Fornecedor) {
    if (!confirm(`Excluir o fornecedor "${fornecedor.nome}"?`)) return;
    const response = await fetch(`/api/operacional/fornecedores/${fornecedor.id}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok || !data.success) {
      toast.erro(data.error ?? "Não foi possível excluir o fornecedor.");
      return;
    }
    toast.sucesso("Fornecedor excluído.");
    carregar();
  }

  return (
    <div className="space-y-6">
      <ToastContainer />

      <div>
        <h1 className="text-2xl font-bold">Fornecedores</h1>
        <p className="text-sm text-gray-500">Materiais, equipamentos e serviços de apoio à instalação.</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <input className="input-field max-w-xs" placeholder="Buscar fornecedor..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        <button type="button" className="btn-primary" onClick={() => setEditando("novo")}>
          + Novo Fornecedor
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
                <th className="px-4 py-2 text-left">Contato</th>
                <th className="px-4 py-2 text-left">Tipo</th>
                <th className="px-4 py-2 text-left">Especialidade</th>
                <th className="px-4 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {fornecedores.map((f) => (
                <tr key={f.id}>
                  <td className="px-4 py-2 font-mono text-xs text-gray-500">{f.numero_fornecedor ?? "—"}</td>
                  <td className="px-4 py-2 font-medium text-brand">{f.nome}</td>
                  <td className="px-4 py-2 text-gray-500">{f.telefone ?? "—"}</td>
                  <td className="px-4 py-2 text-gray-500">{f.cnpj ?? "—"}</td>
                  <td className="px-4 py-2 text-gray-500">{f.pessoa_contato ?? "—"}</td>
                  <td className="px-4 py-2 text-gray-500">{f.tipo_fornecimento ? LABEL_TIPO[f.tipo_fornecimento] : "—"}</td>
                  <td className="px-4 py-2 text-gray-500">{f.especialidade ? LABEL_ESPECIALIDADE[f.especialidade] : "—"}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-end gap-2">
                      <button type="button" className="p-1 hover:opacity-70" title="Editar" onClick={() => setEditando(f)}>
                        ✏️
                      </button>
                      <button type="button" className="p-1 hover:opacity-70" title="Excluir" onClick={() => excluir(f)}>
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {fornecedores.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-gray-400">
                    Nenhum fornecedor cadastrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {editando && (
        <ModalFornecedor
          fornecedor={editando === "novo" ? null : editando}
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
