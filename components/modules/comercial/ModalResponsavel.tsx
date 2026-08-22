"use client";

import { useState } from "react";
import { toast } from "./toast";
import type { Usuario } from "@/lib/types";

interface Props {
  usuario: Usuario | null; // null = criar novo
  onFechar: () => void;
  onSalvo: () => void;
}

/** Modal de criar/editar um "responsável" (linha em `usuarios` — não cria
 * acesso de login, ver lib/repositories/usuario.repository.ts). Email só é
 * pedido na criação — depois de criado, fica fixo (ver comentário em
 * lib/validators/usuario.ts). */
export default function ModalResponsavel({ usuario, onFechar, onSalvo }: Props) {
  const [nome, setNome] = useState(usuario?.nome ?? "");
  const [email, setEmail] = useState(usuario?.email ?? "");
  const [telefone, setTelefone] = useState(usuario?.telefone ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    if (!nome.trim()) {
      setErro("Informe o nome.");
      return;
    }
    if (!usuario && !email.trim()) {
      setErro("Informe o e-mail.");
      return;
    }
    setErro(null);
    setSalvando(true);

    try {
      const response = usuario
        ? await fetch(`/api/usuarios/${usuario.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nome, telefone: telefone || null }),
          })
        : await fetch("/api/usuarios", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nome, email, telefone: telefone || null }),
          });

      const data = await response.json();
      if (!response.ok) {
        setErro(data.error ?? "Erro ao salvar responsável.");
        return;
      }

      toast.sucesso(usuario ? "Responsável atualizado." : "Responsável cadastrado.");
      onSalvo();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand/60 p-4" onClick={onFechar}>
      <div
        className="w-full max-w-md rounded-card bg-white p-6 shadow-card-hover"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 font-montserrat text-lg font-bold text-brand">
          {usuario ? "Editar Responsável" : "Novo Responsável"}
        </h2>

        <div className="space-y-4">
          <div>
            <label className="label-field">
              Nome<span className="text-status-error"> *</span>
            </label>
            <input className="input-field" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div>
            <label className="label-field">
              E-mail{!usuario && <span className="text-status-error"> *</span>}
            </label>
            {usuario ? (
              <p className="input-field cursor-default bg-gray-50 text-gray-600">{email}</p>
            ) : (
              <input className="input-field" value={email} onChange={(e) => setEmail(e.target.value)} />
            )}
          </div>
          <div>
            <label className="label-field">Telefone</label>
            <input className="input-field" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
          </div>

          {erro && <p className="text-sm text-status-error">{erro}</p>}

          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={onFechar}>
              Cancelar
            </button>
            <button type="button" className="btn-primary" onClick={salvar} disabled={salvando}>
              {salvando ? "Salvando..." : usuario ? "Salvar alterações" : "Cadastrar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
