"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "./toast";
import ModalCliente from "./ModalCliente";
import { formatarDataHora } from "@/lib/format";
import type { Cliente } from "@/lib/types";
import type { ClienteResumo } from "@/lib/types/domain";

const POR_PAGINA = 10;

/** Aba "Clientes" do CRM. Paginação client-side (fatiando o array já
 * carregado) — volume esperado pra uma empresa deste porte não justifica
 * paginação no servidor ainda; se a base crescer muito, trocar por
 * `?page=`/`?pageSize=` na query da API é a evolução natural. */
export default function ClientesTab() {
  const [clientes, setClientes] = useState<ClienteResumo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const [editando, setEditando] = useState<Cliente | ClienteResumo | null | "novo">(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const params = new URLSearchParams({ resumo: "1" });
      if (busca) params.set("busca", busca);
      const response = await fetch(`/api/clientes?${params.toString()}`);
      const data = await response.json();
      setClientes(Array.isArray(data) ? data : []);
    } finally {
      setCarregando(false);
    }
  }, [busca]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setPagina(1);
      carregar();
    }, 300);
    return () => clearTimeout(timeout);
  }, [carregar]);

  async function excluir(cliente: ClienteResumo) {
    if (!confirm(`Excluir o cliente "${cliente.nome}"?`)) return;
    const response = await fetch(`/api/clientes/${cliente.id}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) {
      toast.erro(data.error ?? "Não foi possível excluir o cliente.");
      return;
    }
    toast.sucesso("Cliente excluído.");
    carregar();
  }

  const totalPaginas = Math.max(1, Math.ceil(clientes.length / POR_PAGINA));
  const clientesPagina = clientes.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          className="input-field max-w-xs"
          placeholder="Buscar cliente por nome..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <button type="button" className="btn-primary" onClick={() => setEditando("novo")}>
          + Cadastrar novo cliente
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
                <th className="px-4 py-2 text-left">Telefone</th>
                <th className="px-4 py-2 text-left">Email</th>
                <th className="px-4 py-2 text-left">Cidade</th>
                <th className="px-4 py-2 text-left">Última interação</th>
                <th className="px-4 py-2 text-left">Leads</th>
                <th className="px-4 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {clientesPagina.map((cliente) => (
                <tr key={cliente.id}>
                  <td className="px-4 py-2 font-medium">{cliente.nome}</td>
                  <td className="px-4 py-2 text-gray-500">{cliente.telefone ?? "—"}</td>
                  <td className="px-4 py-2 text-gray-500">{cliente.email ?? "—"}</td>
                  <td className="px-4 py-2 text-gray-500">{cliente.cidade ?? "—"}</td>
                  <td className="px-4 py-2 text-gray-500">
                    {cliente.ultima_interacao ? formatarDataHora(cliente.ultima_interacao) : "—"}
                  </td>
                  <td className="px-4 py-2 text-gray-500">{cliente.total_leads}</td>
                  <td className="px-4 py-2 text-right">
                    <button type="button" className="mr-2 hover:opacity-70" title="Editar" onClick={() => setEditando(cliente)}>
                      ✏️
                    </button>
                    <button type="button" className="hover:opacity-70" title="Excluir" onClick={() => excluir(cliente)}>
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
              {clientesPagina.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-gray-400">
                    Nenhum cliente encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {totalPaginas > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button type="button" className="btn-secondary text-xs" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>
            ← Anterior
          </button>
          <span className="text-xs text-gray-500">
            Página {pagina} de {totalPaginas}
          </span>
          <button
            type="button"
            className="btn-secondary text-xs"
            disabled={pagina >= totalPaginas}
            onClick={() => setPagina((p) => p + 1)}
          >
            Próxima →
          </button>
        </div>
      )}

      {editando && (
        <ModalCliente
          cliente={editando === "novo" ? null : (editando as unknown as Cliente)}
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
