import { z } from "zod";

/** Projeção financeira (migração 054): só o essencial de um lançamento. */
export const CreateProjecaoSchema = z.object({
  tipo: z.enum(["receita", "despesa"]),
  categoria: z.string().trim().min(1, "Escolha a categoria."),
  descricao: z.string().trim().min(1, "Informe a descrição."),
  valor: z.number().positive("O valor precisa ser maior que zero."),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe o vencimento."),
});

export const UpdateProjecaoSchema = CreateProjecaoSchema.partial();

export type CreateProjecaoInput = z.infer<typeof CreateProjecaoSchema>;
