import { z } from "zod";
import { DOMINIO_EMAIL, MODULOS, emailPermitido } from "../acesso";

// Usuários do sistema (RH → Usuários, migração 039). Uma linha em `usuarios`
// é ao mesmo tempo o "responsável" dos dropdowns de Comercial/Operacional e,
// quando tem login criado, a conta de acesso com seus módulos liberados.

const SENHA_MINIMA = 8;

const senha = z.string().min(SENHA_MINIMA, `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`);
const modulos = z.array(z.enum(MODULOS));

export const CreateUsuarioSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("E-mail inválido.")
    .refine(emailPermitido, `O e-mail precisa ser @${DOMINIO_EMAIL}.`),
  telefone: z.string().trim().nullable().optional(),
  admin: z.boolean().default(false),
  modulos: modulos.default([]),
  /** Senha provisória — quando informada, o login é criado junto e o usuário
   * é obrigado a trocá-la no primeiro acesso. Sem ela, a pessoa fica só como
   * responsável selecionável, sem acesso ao sistema. */
  senha: senha.optional(),
});

// `email` não é editável de propósito — várias tabelas referenciam
// usuarios(email) (responsável de lead/serviço, autor de histórico, quem
// anexou um arquivo). Trocar o e-mail de alguém é uma migração de dados, não
// uma edição de cadastro.
export const UpdateUsuarioSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome.").optional(),
  telefone: z.string().trim().nullable().optional(),
  admin: z.boolean().optional(),
  modulos: modulos.optional(),
  ativo: z.boolean().optional(),
});

export const DefinirSenhaUsuarioSchema = z.object({ senha });

export type CreateUsuarioInput = z.infer<typeof CreateUsuarioSchema>;
export type UpdateUsuarioInput = z.infer<typeof UpdateUsuarioSchema>;
