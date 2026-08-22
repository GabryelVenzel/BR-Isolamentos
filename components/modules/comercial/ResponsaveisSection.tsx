"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "./toast";
import ModalResponsavel from "./ModalResponsavel";
import type { Usuario } from "@/lib/types";

/** Cadastro de responsáveis (aba Configurações) — quem pode ser atribuído a
 * um lead no Kanban. É uma linha em `usuarios`, mas NÃO cria acesso de login
 * (isso é feito manualmente no Supabase Auth) — ver
 * lib/repositories/usuario.repository.ts. Sem "excluir": desativar
 * (`ativo: false`) é o jeito de remover alguém do dropdown sem quebrar leads/
 * orçamentos já atribuídos a essa pessoa (a FK bloquearia um DELETE real). */
export default function ResponsaveisSection() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [editando, setEditando] = useState<Usuario | "novo" | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const response = await fetch("/api/usuarios?todos=1");
      const data = await response.json();
      setUsuarios(Array.isArray(data) ? data : []);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function alternarAtivo(usuario: Usuario) {
    const response = await fetch(`/api/usuarios/${usuario.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: !usuario.ativo }),
    });
    const data = await response.json();
    if (!response.ok) {
      toast.erro(data.error ?? "Não foi possível atualizar o responsável.");
      return;
    }
    toast.sucesso(usuario.ativo ? "Responsável desativado." : "Responsável reativado.");
    carregar();
  }

  return (
    <div className="card max-w-2xl space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-montserrat text-sm font-bold uppercase text-brand">Responsáveis</h2>
          <p className="text-xs text-gray-500">
            Quem pode ser atribuído a um lead no Kanban. Cadastrar aqui não cria acesso de login.
          </p>
        </div>
        <button type="button" className="btn-primary shrink-0 text-xs" onClick={() => setEditando("novo")}>
          + Adicionar
        </button>
      </div>

      {carregando ? (
        <p className="text-sm text-gray-500">Carregando...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-3 py-2 text-left">Nome</th>
                <th className="px-3 py-2 text-left">Email</th>
                <th className="px-3 py-2 text-left">Telefone</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {usuarios.map((u) => (
                <tr key={u.id} className={u.ativo ? "" : "opacity-50"}>
                  <td className="px-3 py-2 font-medium">{u.nome}</td>
                  <td className="px-3 py-2 text-gray-500">{u.email}</td>
                  <td className="px-3 py-2 text-gray-500">{u.telefone ?? "—"}</td>
                  <td className="px-3 py-2">
                    <span className={`badge ${u.ativo ? "bg-accent-light text-accent-dark" : "bg-gray-100 text-gray-500"}`}>
                      {u.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button type="button" className="mr-2 hover:opacity-70" title="Editar" onClick={() => setEditando(u)}>
                      ✏️
                    </button>
                    <button
                      type="button"
                      className="text-xs text-brand hover:underline"
                      onClick={() => alternarAtivo(u)}
                    >
                      {u.ativo ? "Desativar" : "Ativar"}
                    </button>
                  </td>
                </tr>
              ))}
              {usuarios.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-gray-400">
                    Nenhum responsável cadastrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {editando && (
        <ModalResponsavel
          usuario={editando === "novo" ? null : editando}
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
