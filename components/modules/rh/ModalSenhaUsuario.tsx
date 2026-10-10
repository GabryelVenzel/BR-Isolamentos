"use client";

import { useState } from "react";
import { toast } from "./toast";
import type { UsuarioComAcesso } from "@/lib/usecases/rh";
import FecharComEsc from "@/components/ui/FecharComEsc";

interface Props {
  usuario: UsuarioComAcesso;
  onFechar: () => void;
  onSalvo: () => void;
}

/** Cria o login de quem ainda não tem ou redefine a senha de quem já tem —
 * nos dois casos com senha provisória, trocada no próximo acesso. */
export default function ModalSenhaUsuario({ usuario, onFechar, onSalvo }: Props) {
  const [senha, setSenha] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    if (senha.length < 8) {
      setErro("A senha provisória precisa ter pelo menos 8 caracteres.");
      return;
    }
    setErro(null);
    setSalvando(true);
    try {
      const response = await fetch(`/api/rh/usuarios/${usuario.id}/senha`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senha }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        setErro(payload.error ?? "Não foi possível definir a senha.");
        return;
      }
      toast.sucesso(usuario.tem_login ? "Senha redefinida." : "Login criado.");
      onSalvo();
    } catch {
      setErro("Erro de conexão. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand/60 p-4">
      <FecharComEsc onFechar={onFechar} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-modal-senha"
        className="w-full max-w-sm rounded-card bg-white p-6 shadow-card-hover"
      >
        <h2 id="titulo-modal-senha" className="mb-1 font-montserrat text-lg font-bold text-brand">
          {usuario.tem_login ? "Redefinir senha" : "Criar login"}
        </h2>
        <p className="mb-4 text-sm text-gray-500">
          {usuario.nome} — {usuario.email}
        </p>

        <label className="label-field" htmlFor="senha-provisoria">
          Senha provisória
        </label>
        <input
          id="senha-provisoria"
          type="text"
          className="input-field"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          autoComplete="off"
        />
        <p className="mt-1 text-xs text-gray-500">
          Mínimo de 8 caracteres. A pessoa será obrigada a trocar no próximo acesso.
        </p>

        {erro && (
          <p role="alert" className="mt-3 text-sm text-status-error">
            {erro}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={onFechar}>
            Cancelar
          </button>
          <button type="button" className="btn-primary" onClick={salvar} disabled={salvando}>
            {salvando ? "Salvando..." : usuario.tem_login ? "Redefinir" : "Criar login"}
          </button>
        </div>
      </div>
    </div>
  );
}
