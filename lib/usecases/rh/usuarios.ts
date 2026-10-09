import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { UsuarioRepository } from "../../repositories";
import type { Usuario } from "../../types";
import { ehModulo, emailPermitido, DOMINIO_EMAIL, type Modulo } from "../../acesso";
import { ConflictError, ValidationError } from "../../errors";
import { CreateUsuarioSchema, DefinirSenhaUsuarioSchema, UpdateUsuarioSchema, parseOrThrow } from "../../validators";

// Gestão de usuários e níveis de acesso (RH → Usuários, migração 039).
//
// Cada alteração grava em DOIS lugares, nesta ordem:
//   1. tabela `usuarios` (pelo cliente da sessão do administrador — passa pela
//      regra de acesso e fica no registro de auditoria com o e-mail dele);
//   2. conta de login no Supabase Auth (`app_metadata`, pela chave de serviço)
//      — o espelho que o middleware lê (ver lib/acesso.ts).

export interface UsuarioComAcesso extends Usuario {
  tem_login: boolean;
  ultimo_acesso: string | null;
  /** Ainda não trocou a senha provisória. */
  senha_provisoria: boolean;
}

export interface DepsUsuarios {
  usuarioRepo: UsuarioRepository;
  /** Cliente com a chave de serviço (lib/supabase/admin.ts). */
  admin: SupabaseClient;
}

/** Suspensão "permanente" do login de um usuário desativado (o Auth só
 * aceita duração, não uma data infinita). */
const BANIMENTO_DESATIVADO = "876000h";

async function listarContas(admin: SupabaseClient): Promise<Map<string, User>> {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  return new Map(data.users.filter((u) => u.email).map((u) => [u.email!.toLowerCase(), u]));
}

function modulosDe(usuario: Pick<Usuario, "modulos">): Modulo[] {
  return (usuario.modulos ?? []).filter(ehModulo);
}

function espelho(usuario: Usuario, trocarSenha: boolean) {
  return {
    admin: usuario.role === "admin",
    modulos: modulosDe(usuario),
    ativo: usuario.ativo,
    trocar_senha: trocarSenha,
  };
}

async function sincronizarConta(admin: SupabaseClient, conta: User, usuario: Usuario): Promise<void> {
  const { error } = await admin.auth.admin.updateUserById(conta.id, {
    app_metadata: { ...conta.app_metadata, ...espelho(usuario, conta.app_metadata?.trocar_senha === true) },
    ban_duration: usuario.ativo ? "none" : BANIMENTO_DESATIVADO,
  });
  if (error) throw error;
}

export async function listarUsuariosComAcesso({ usuarioRepo, admin }: DepsUsuarios): Promise<UsuarioComAcesso[]> {
  const [usuarios, contas] = await Promise.all([usuarioRepo.listarTodos(), listarContas(admin)]);
  return usuarios.map((u) => {
    const conta = contas.get(u.email.toLowerCase());
    return {
      ...u,
      modulos: modulosDe(u),
      tem_login: Boolean(conta),
      ultimo_acesso: conta?.last_sign_in_at ?? null,
      senha_provisoria: conta?.app_metadata?.trocar_senha === true,
    };
  });
}

export async function criarUsuario(input: unknown, deps: DepsUsuarios): Promise<Usuario> {
  const dados = parseOrThrow(CreateUsuarioSchema, input);
  const { usuarioRepo, admin } = deps;

  const usuario = await usuarioRepo.create({
    nome: dados.nome,
    email: dados.email,
    telefone: dados.telefone ?? null,
    role: dados.admin ? "admin" : "consultor",
    modulos: dados.modulos,
    ativo: true,
  });

  if (dados.senha) await criarLogin(usuario, dados.senha, admin);
  return usuario;
}

async function criarLogin(usuario: Usuario, senha: string, admin: SupabaseClient): Promise<void> {
  if (!emailPermitido(usuario.email)) {
    throw new ValidationError(`Só é possível criar login para e-mails @${DOMINIO_EMAIL}.`);
  }
  const { error } = await admin.auth.admin.createUser({
    email: usuario.email,
    password: senha,
    email_confirm: true,
    app_metadata: espelho(usuario, true),
  });
  if (error) throw new ConflictError(`Não foi possível criar o login: ${error.message}`);
}

export async function atualizarUsuario(id: string, input: unknown, emailDoAtor: string, deps: DepsUsuarios): Promise<Usuario> {
  const dados = parseOrThrow(UpdateUsuarioSchema, input);
  const { usuarioRepo, admin } = deps;

  const [atual, todos, contas] = await Promise.all([usuarioRepo.findByIdOrThrow(id), usuarioRepo.listarTodos(), listarContas(admin)]);

  const ehOProprio = atual.email.toLowerCase() === emailDoAtor.toLowerCase();
  const deixaDeSerAdmin = atual.role === "admin" && dados.admin === false;
  const desativa = atual.ativo && dados.ativo === false;

  if (ehOProprio && (deixaDeSerAdmin || desativa)) {
    throw new ConflictError("Você não pode desativar ou tirar o próprio acesso de administrador.");
  }

  // Nunca deixar o sistema sem um administrador que consiga entrar.
  if (atual.role === "admin" && (deixaDeSerAdmin || desativa)) {
    const outrosAdmins = todos.filter(
      (u) => u.id !== atual.id && u.role === "admin" && u.ativo && contas.has(u.email.toLowerCase())
    );
    if (outrosAdmins.length === 0) {
      throw new ConflictError("Este é o único administrador com login ativo — defina outro antes de alterar este.");
    }
  }

  const usuario = await usuarioRepo.update(id, {
    ...(dados.nome !== undefined && { nome: dados.nome }),
    ...(dados.telefone !== undefined && { telefone: dados.telefone }),
    ...(dados.admin !== undefined && { role: dados.admin ? ("admin" as const) : ("consultor" as const) }),
    ...(dados.modulos !== undefined && { modulos: dados.modulos }),
    ...(dados.ativo !== undefined && { ativo: dados.ativo }),
  });

  const conta = contas.get(usuario.email.toLowerCase());
  if (conta) await sincronizarConta(admin, conta, usuario);
  return usuario;
}

/** Cria o login (se a pessoa ainda não tem) ou redefine a senha — nos dois
 * casos a senha é provisória: o usuário troca no próximo acesso. */
export async function definirSenhaUsuario(id: string, input: unknown, deps: DepsUsuarios): Promise<void> {
  const { senha } = parseOrThrow(DefinirSenhaUsuarioSchema, input);
  const { usuarioRepo, admin } = deps;

  const usuario = await usuarioRepo.findByIdOrThrow(id);
  const conta = (await listarContas(admin)).get(usuario.email.toLowerCase());

  if (!conta) {
    await criarLogin(usuario, senha, admin);
    return;
  }

  const { error } = await admin.auth.admin.updateUserById(conta.id, {
    password: senha,
    app_metadata: { ...conta.app_metadata, ...espelho(usuario, true) },
    ban_duration: usuario.ativo ? "none" : BANIMENTO_DESATIVADO,
  });
  if (error) throw error;
}
