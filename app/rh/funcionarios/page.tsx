"use client";

import { useCallback, useEffect, useState } from "react";
import ToastContainer from "@/components/modules/rh/ToastContainer";
import { toast } from "@/components/modules/rh/toast";
import ModalFuncionario from "@/components/modules/rh/ModalFuncionario";
import type { Funcionario } from "@/lib/types/domain";

const LABEL_STATUS: Record<string, string> = { ativo: "Ativo", inativo: "Inativo", desligado: "Desligado" };
const CLASSE_STATUS: Record<string, string> = {
  ativo: "bg-accent-light text-accent-dark",
  inativo: "bg-secondary-light text-brand",
  desligado: "bg-gray-100 text-gray-500",
};

export default function FuncionariosPage() {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState<Funcionario | "novo" | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const params = new URLSearchParams();
      if (busca) params.set("busca", busca);
      const response = await fetch(`/api/rh/funcionarios?${params.toString()}`);
      const payload = await response.json();
      if (payload.success) setFuncionarios(payload.data);
    } finally {
      setCarregando(false);
    }
  }, [busca]);

  useEffect(() => {
    const timeout = setTimeout(carregar, 300);
    return () => clearTimeout(timeout);
  }, [carregar]);

  async function excluir(funcionario: Funcionario) {
    if (!confirm(`Excluir o funcionário "${funcionario.nome}"? Todos os documentos anexados dele também serão removidos.`)) return;
    const response = await fetch(`/api/rh/funcionarios/${funcionario.id}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok || !data.success) {
      toast.erro(data.error ?? "Não foi possível excluir o funcionário.");
      return;
    }
    toast.sucesso("Funcionário excluído.");
    carregar();
  }

  return (
    <div className="space-y-6">
      <ToastContainer />

      <div>
        <h1 className="text-2xl font-bold">Funcionários</h1>
        <p className="text-sm text-gray-500">Cadastro de colaboradores e documentação de cada um (ASO, NRs, certificações...).</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <input className="input-field max-w-xs" placeholder="Buscar funcionário..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        <button type="button" className="btn-primary" onClick={() => setEditando("novo")}>
          + Novo Colaborador
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
                <th className="px-4 py-2 text-left">Cargo</th>
                <th className="px-4 py-2 text-left">Telefone</th>
                <th className="px-4 py-2 text-left">Admissão</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {funcionarios.map((f) => (
                <tr key={f.id}>
                  <td className="px-4 py-2 font-mono text-xs text-gray-500">{f.numero_funcionario ?? "—"}</td>
                  <td className="px-4 py-2 font-medium text-brand">{f.nome}</td>
                  <td className="px-4 py-2 text-gray-500">{f.cargo ?? "—"}</td>
                  <td className="px-4 py-2 text-gray-500">{f.telefone ?? "—"}</td>
                  <td className="px-4 py-2 text-gray-500">{f.data_admissao ?? "—"}</td>
                  <td className="px-4 py-2">
                    <span className={`badge ${CLASSE_STATUS[f.status] ?? "bg-gray-100 text-gray-500"}`}>{LABEL_STATUS[f.status] ?? f.status}</span>
                  </td>
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
              {funcionarios.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-gray-400">
                    Nenhum funcionário cadastrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {!carregando && (
        <p className="text-xs text-gray-400">
          {funcionarios.length} funcionário{funcionarios.length === 1 ? "" : "s"} encontrado{funcionarios.length === 1 ? "" : "s"}.
        </p>
      )}

      {editando && (
        <ModalFuncionario
          funcionario={editando === "novo" ? null : editando}
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
