"use client";

import { useState, type FormEvent } from "react";
import CampoSenha from "@/components/CampoSenha";
import { useAcesso } from "@/lib/hooks/useAcesso";

const TAMANHO_MINIMO = 8;

/** Troca da própria senha — tela obrigatória no primeiro acesso com senha
 * provisória (o middleware prende o usuário aqui até concluir) e acessível
 * depois pelo link "Senha" da barra superior. */
export default function TrocarSenhaPage() {
  const { acesso } = useAcesso();
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [concluido, setConcluido] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErro(null);

    if (novaSenha.length < TAMANHO_MINIMO) {
      setErro(`A senha precisa ter pelo menos ${TAMANHO_MINIMO} caracteres.`);
      return;
    }
    if (novaSenha !== confirmacao) {
      setErro("As duas senhas não são iguais.");
      return;
    }

    setSalvando(true);
    try {
      const response = await fetch("/api/auth/senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ novaSenha }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        setErro(payload.error ?? "Não foi possível alterar a senha.");
        return;
      }
      setConcluido(true);
      // Recarrega pela raiz: o middleware leva pra primeira tela liberada.
      window.location.href = "/";
    } catch {
      setErro("Erro de conexão. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="card w-full max-w-sm">
        <h1 className="mb-1 text-xl font-bold">{acesso?.trocarSenha ? "Defina a sua senha" : "Alterar senha"}</h1>
        <p className="mb-6 text-sm text-gray-500">
          {acesso?.trocarSenha
            ? "Você entrou com uma senha provisória. Crie a sua senha para continuar."
            : "A nova senha vale a partir do próximo acesso."}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <CampoSenha id="nova-senha" label="Nova senha" value={novaSenha} onChange={setNovaSenha} autoComplete="new-password" />
          <CampoSenha id="confirmacao" label="Repita a nova senha" value={confirmacao} onChange={setConfirmacao} autoComplete="new-password" />
          <p className="text-xs text-gray-500">Mínimo de {TAMANHO_MINIMO} caracteres.</p>

          {erro && (
            <p role="alert" className="rounded-input border border-red-200 bg-red-50 px-3 py-2 text-sm text-status-error">
              {erro}
            </p>
          )}

          <button type="submit" className="btn-primary w-full" disabled={salvando || concluido}>
            {salvando ? "Salvando..." : concluido ? "Senha alterada" : "Salvar senha"}
          </button>
        </form>
      </div>
    </div>
  );
}
