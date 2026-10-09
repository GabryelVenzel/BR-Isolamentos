"use client";

import { useState } from "react";
import { toast } from "./toast";
import { DOMINIO_EMAIL, LABEL_MODULO, MODULOS, type Modulo } from "@/lib/acesso";
import type { UsuarioComAcesso } from "@/lib/usecases/rh";

interface Props {
  usuario: UsuarioComAcesso | null; // null = cadastrar novo
  /** E-mail de quem está logado — não pode tirar o próprio acesso. */
  emailLogado: string | null;
  onFechar: () => void;
  onSalvo: () => void;
}

export default function ModalUsuario({ usuario, emailLogado, onFechar, onSalvo }: Props) {
  const [nome, setNome] = useState(usuario?.nome ?? "");
  const [email, setEmail] = useState(usuario?.email ?? "");
  const [telefone, setTelefone] = useState(usuario?.telefone ?? "");
  const [admin, setAdmin] = useState(usuario?.role === "admin");
  const [modulos, setModulos] = useState<Modulo[]>((usuario?.modulos as Modulo[] | undefined) ?? []);
  const [criarLogin, setCriarLogin] = useState(!usuario);
  const [senha, setSenha] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const ehOProprio = Boolean(usuario && emailLogado && usuario.email.toLowerCase() === emailLogado.toLowerCase());

  function alternarModulo(modulo: Modulo) {
    setModulos((atual) => (atual.includes(modulo) ? atual.filter((m) => m !== modulo) : [...atual, modulo]));
  }

  async function salvar() {
    if (!nome.trim()) {
      setErro("Informe o nome.");
      return;
    }
    if (!usuario && !email.trim().toLowerCase().endsWith(`@${DOMINIO_EMAIL}`)) {
      setErro(`O e-mail precisa ser @${DOMINIO_EMAIL}.`);
      return;
    }
    if (!usuario && criarLogin && senha.length < 8) {
      setErro("A senha provisória precisa ter pelo menos 8 caracteres.");
      return;
    }
    setErro(null);
    setSalvando(true);

    try {
      const response = usuario
        ? await fetch(`/api/rh/usuarios/${usuario.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nome, telefone: telefone.trim() || null, admin, modulos }),
          })
        : await fetch("/api/rh/usuarios", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              nome,
              email,
              telefone: telefone.trim() || null,
              admin,
              modulos,
              ...(criarLogin && { senha }),
            }),
          });

      const payload = await response.json();
      if (!response.ok || !payload.success) {
        setErro(payload.error ?? "Não foi possível salvar o usuário.");
        return;
      }

      toast.sucesso(usuario ? "Usuário atualizado." : "Usuário cadastrado.");
      onSalvo();
    } catch {
      setErro("Erro de conexão. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand/60 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-modal-usuario"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-card bg-white p-6 shadow-card-hover"
      >
        <h2 id="titulo-modal-usuario" className="mb-4 font-montserrat text-lg font-bold text-brand">
          {usuario ? "Editar usuário" : "Novo usuário"}
        </h2>

        <div className="space-y-4">
          <div>
            <label className="label-field" htmlFor="usuario-nome">
              Nome<span className="text-status-error"> *</span>
            </label>
            <input id="usuario-nome" className="input-field" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label-field" htmlFor="usuario-email">
                E-mail<span className="text-status-error"> *</span>
              </label>
              <input
                id="usuario-email"
                type="email"
                className="input-field disabled:bg-gray-100 disabled:text-gray-500"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={Boolean(usuario)}
                placeholder={`nome@${DOMINIO_EMAIL}`}
              />
              {usuario && <p className="mt-1 text-xs text-gray-500">O e-mail não pode ser alterado.</p>}
            </div>
            <div>
              <label className="label-field" htmlFor="usuario-telefone">
                Telefone
              </label>
              <input id="usuario-telefone" className="input-field" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
            </div>
          </div>

          <fieldset className="rounded-card border border-gray-200 p-4">
            <legend className="px-1 font-montserrat text-sm font-semibold text-brand">Nível de acesso</legend>

            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={admin}
                disabled={ehOProprio}
                onChange={(e) => setAdmin(e.target.checked)}
              />
              <span>
                <span className="font-semibold text-brand">Administrador</span>
                <span className="block text-xs text-gray-500">
                  Acessa todos os módulos, gerencia usuários e vê o registro de alterações.
                </span>
              </span>
            </label>

            {!admin && (
              <div className="mt-4">
                <p className="mb-2 text-xs text-gray-500">Módulos liberados:</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {MODULOS.map((modulo) => (
                    <label key={modulo} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={modulos.includes(modulo)} onChange={() => alternarModulo(modulo)} />
                      {LABEL_MODULO[modulo]}
                    </label>
                  ))}
                </div>
                {modulos.length === 0 && (
                  <p className="mt-2 text-xs text-gray-500">
                    Sem nenhum módulo marcado, a pessoa aparece como responsável nas listas, mas não abre nenhuma tela.
                  </p>
                )}
              </div>
            )}
          </fieldset>

          {!usuario && (
            <fieldset className="rounded-card border border-gray-200 p-4">
              <legend className="px-1 font-montserrat text-sm font-semibold text-brand">Login</legend>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={criarLogin} onChange={(e) => setCriarLogin(e.target.checked)} />
                Criar login agora
              </label>
              {criarLogin && (
                <div className="mt-3">
                  <label className="label-field" htmlFor="usuario-senha">
                    Senha provisória
                  </label>
                  <input
                    id="usuario-senha"
                    type="text"
                    className="input-field"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    autoComplete="off"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Mínimo de 8 caracteres. Passe para a pessoa; ela será obrigada a trocar no primeiro acesso.
                  </p>
                </div>
              )}
            </fieldset>
          )}

          {erro && (
            <p role="alert" className="text-sm text-status-error">
              {erro}
            </p>
          )}

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
