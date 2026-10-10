"use client";

import { useCallback, useEffect, useState } from "react";
import TabsNavigation from "@/components/TabsNavigation";
import { toast } from "@/components/modules/rh/toast";
import ModalUsuario from "@/components/modules/rh/ModalUsuario";
import ModalSenhaUsuario from "@/components/modules/rh/ModalSenhaUsuario";
import RegistroAlteracoes from "@/components/modules/rh/RegistroAlteracoes";
import { LABEL_MODULO, ehModulo } from "@/lib/acesso";
import { formatarDataHora } from "@/lib/format";
import { useAcesso } from "@/lib/hooks/useAcesso";
import type { UsuarioComAcesso } from "@/lib/usecases/rh";

type Aba = "usuarios" | "alteracoes";

const ABAS: Array<{ valor: Aba; label: string }> = [
  { valor: "usuarios", label: "Usuários" },
  { valor: "alteracoes", label: "Registro de alterações" },
];

/** RH → Usuários (só administradores): quem entra no sistema, o que cada um
 * acessa, e o registro de quem alterou o quê. A mesma lista alimenta os
 * dropdowns de "Responsável" de Comercial e Operacional — antes era a seção
 * "Responsáveis" de Comercial → Configurações. */
export default function UsuariosPage() {
  const { email: emailLogado } = useAcesso();
  const [aba, setAba] = useState<Aba>("usuarios");
  const [usuarios, setUsuarios] = useState<UsuarioComAcesso[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [editando, setEditando] = useState<UsuarioComAcesso | "novo" | null>(null);
  const [definindoSenha, setDefinindoSenha] = useState<UsuarioComAcesso | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const response = await fetch("/api/rh/usuarios");
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        setErro(payload.error ?? "Não foi possível carregar os usuários.");
        return;
      }
      setUsuarios(payload.data);
    } catch {
      setErro("Erro de conexão ao carregar os usuários.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function alternarAtivo(usuario: UsuarioComAcesso) {
    const response = await fetch(`/api/rh/usuarios/${usuario.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: !usuario.ativo }),
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) {
      toast.erro(payload.error ?? "Não foi possível atualizar o usuário.");
      return;
    }
    toast.sucesso(usuario.ativo ? "Usuário desativado — o acesso dele foi bloqueado." : "Usuário reativado.");
    carregar();
  }

  function descricaoAcesso(usuario: UsuarioComAcesso) {
    if (usuario.role === "admin") return <span className="badge bg-brand text-white">Administrador</span>;
    const modulos = usuario.modulos.filter(ehModulo);
    if (modulos.length === 0) return <span className="text-xs text-gray-400">Nenhum módulo</span>;
    return (
      <div className="flex flex-wrap gap-1">
        {modulos.map((m) => (
          <span key={m} className="badge bg-brand-light text-brand">
            {LABEL_MODULO[m]}
          </span>
        ))}
      </div>
    );
  }

  function descricaoLogin(usuario: UsuarioComAcesso) {
    if (!usuario.tem_login) return <span className="text-xs text-gray-400">Sem login</span>;
    if (usuario.senha_provisoria) return <span className="badge bg-secondary-light text-brand">Senha provisória</span>;
    return (
      <span className="text-xs text-gray-500">
        {usuario.ultimo_acesso ? `Último acesso: ${formatarDataHora(usuario.ultimo_acesso)}` : "Nunca entrou"}
      </span>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Usuários e acessos</h1>
          <p className="text-sm text-gray-500">Quem entra no sistema, quais módulos cada pessoa acessa e quem alterou o quê.</p>
        </div>
        {aba === "usuarios" && (
          <button type="button" className="btn-primary" onClick={() => setEditando("novo")}>
            + Novo usuário
          </button>
        )}
      </div>

      <TabsNavigation tabs={ABAS} activeTab={aba} onTabChange={setAba} />

      {aba === "usuarios" && (
        <>
          {erro && (
            <div className="card text-sm text-status-error">
              <p>{erro}</p>
              <button type="button" className="btn-secondary mt-3" onClick={carregar}>
                Tentar de novo
              </button>
            </div>
          )}

          {carregando ? (
            <p className="text-sm text-gray-500">Carregando...</p>
          ) : (
            !erro && (
              <div className="card overflow-x-auto p-0">
                <table className="tabela-cartoes w-full text-sm">
                  <thead>
                    <tr className="table-header">
                      <th className="px-4 py-2 text-left">Nome</th>
                      <th className="px-4 py-2 text-left">E-mail</th>
                      <th className="px-4 py-2 text-left">Acesso</th>
                      <th className="px-4 py-2 text-left">Login</th>
                      <th className="px-4 py-2 text-left">Situação</th>
                      <th className="px-4 py-2 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {usuarios.map((u) => (
                      <tr key={u.id} className={u.ativo ? "" : "opacity-60"}>
                        <td data-label="Nome" className="px-4 py-2 font-medium text-brand">{u.nome}</td>
                        <td data-label="E-mail" className="px-4 py-2 text-gray-500">{u.email}</td>
                        <td data-label="Acesso" className="px-4 py-2">{descricaoAcesso(u)}</td>
                        <td data-label="Login" className="px-4 py-2">{descricaoLogin(u)}</td>
                        <td data-label="Situação" className="px-4 py-2">
                          <span className={`badge ${u.ativo ? "bg-accent-light text-accent-dark" : "bg-gray-100 text-gray-500"}`}>
                            {u.ativo ? "Ativo" : "Inativo"}
                          </span>
                        </td>
                        <td data-label="Ações" className="px-4 py-2">
                          <div className="flex items-center justify-end gap-3 text-xs font-semibold">
                            <button type="button" className="text-brand hover:underline" onClick={() => setEditando(u)}>
                              Editar
                            </button>
                            <button type="button" className="text-brand hover:underline" onClick={() => setDefinindoSenha(u)}>
                              {u.tem_login ? "Redefinir senha" : "Criar login"}
                            </button>
                            <button
                              type="button"
                              className={u.ativo ? "text-status-error hover:underline" : "text-accent-dark hover:underline"}
                              onClick={() => alternarAtivo(u)}
                            >
                              {u.ativo ? "Desativar" : "Reativar"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {usuarios.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                          Nenhum usuário cadastrado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )
          )}
        </>
      )}

      {aba === "alteracoes" && <RegistroAlteracoes />}

      {editando && (
        <ModalUsuario
          usuario={editando === "novo" ? null : editando}
          emailLogado={emailLogado}
          onFechar={() => setEditando(null)}
          onSalvo={() => {
            setEditando(null);
            carregar();
          }}
        />
      )}

      {definindoSenha && (
        <ModalSenhaUsuario
          usuario={definindoSenha}
          onFechar={() => setDefinindoSenha(null)}
          onSalvo={() => {
            setDefinindoSenha(null);
            carregar();
          }}
        />
      )}
    </div>
  );
}
