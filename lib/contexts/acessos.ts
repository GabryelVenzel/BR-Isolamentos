// Contexto de gestão de usuários, níveis de acesso e registro de alterações
// (RH → Usuários, migração 039). Separado de lib/contexts/rh.ts porque é o
// único que usa a chave de serviço — e só administradores chegam aqui (ver
// `exigirAdmin` abaixo e a regra de rota em lib/acesso.ts).

import type { SupabaseClient } from "@supabase/supabase-js";
import { acessoDeMetadata } from "../acesso";
import { ForbiddenError, UnauthorizedError } from "../errors";
import { AuditoriaRepository, UsuarioRepository, type FiltrosAuditoria } from "../repositories";
import { createSupabaseAdminClient } from "../supabase/admin";
import { atualizarUsuario, criarUsuario, definirSenhaUsuario, listarUsuariosComAcesso } from "../usecases/rh";

/** Confere de novo, dentro da rota, que quem chama é administrador ativo —
 * o middleware já barra, mas esta é a operação mais sensível do sistema e
 * não deve depender de uma única checagem. Devolve o e-mail de quem chama. */
async function exigirAdmin(supabase: SupabaseClient): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) throw new UnauthorizedError("Sessão expirada. Entre novamente.");
  const acesso = acessoDeMetadata(user.app_metadata);
  if (!acesso.ativo || !acesso.admin) throw new ForbiddenError("Apenas administradores podem gerenciar usuários.");
  return user.email;
}

export function createAcessosContext(supabase: SupabaseClient) {
  const usuarioRepo = new UsuarioRepository(supabase);
  const auditoriaRepo = new AuditoriaRepository(supabase);
  const deps = () => ({ usuarioRepo, admin: createSupabaseAdminClient() });

  return {
    async listarUsuarios() {
      await exigirAdmin(supabase);
      return listarUsuariosComAcesso(deps());
    },

    async criarUsuario(dados: unknown) {
      await exigirAdmin(supabase);
      return criarUsuario(dados, deps());
    },

    async atualizarUsuario(id: string, dados: unknown) {
      const emailDoAtor = await exigirAdmin(supabase);
      return atualizarUsuario(id, dados, emailDoAtor, deps());
    },

    async definirSenha(id: string, dados: unknown) {
      await exigirAdmin(supabase);
      return definirSenhaUsuario(id, dados, deps());
    },

    async listarAuditoria(filtros: FiltrosAuditoria) {
      await exigirAdmin(supabase);
      return auditoriaRepo.listar(filtros);
    },
  };
}
