import { z } from "zod";

/** Cadastro de "responsável" (linha em `usuarios`, ver aba Configurações do
 * módulo Comercial) — NÃO cria acesso de login, só um perfil selecionável no
 * dropdown "Responsável" do Kanban. `role` fica sempre "consultor" (só quem
 * já tem uma conta configurada manualmente no Supabase Auth + já é
 * "admin" em `usuarios` pode promover alguém — fora do escopo desta tela). */
export const CreateUsuarioSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome."),
  email: z.string().trim().email("E-mail inválido."),
  telefone: z.string().trim().nullable().optional(),
});

// `email` não é editável de propósito — leads.atribuido_a e
// orcamentos.atribuido_a referenciam usuarios(email) diretamente; "renomear"
// o email de um responsável já usado quebraria (ou desalinharia
// silenciosamente) essas referências. Pra trocar o e-mail de alguém, criar
// um responsável novo e desativar o antigo.
export const UpdateUsuarioSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome.").optional(),
  telefone: z.string().trim().nullable().optional(),
  ativo: z.boolean().optional(),
});

export type CreateUsuarioInput = z.infer<typeof CreateUsuarioSchema>;
export type UpdateUsuarioInput = z.infer<typeof UpdateUsuarioSchema>;
