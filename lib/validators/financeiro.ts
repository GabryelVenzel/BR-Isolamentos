import { z } from "zod";

export const CreateLancamentoSchema = z.object({
  tipo: z.enum(["receita", "despesa"]),
  categoria: z.string().trim().min(1, "Informe a categoria."),
  data: z.string().min(1, "Informe a data."),
  descricao: z.string().trim().min(1, "Descreva o lançamento."),
  valor: z.number().positive("O valor precisa ser maior que zero."),
  pago: z.boolean().optional(),
  data_pagamento: z.string().nullable().optional(),
  orcamento_id: z.number().int().positive().nullable().optional(),
  arquivo_url: z.string().trim().nullable().optional(),
});

export const UpdateLancamentoSchema = CreateLancamentoSchema.partial();

export const CreateCustoFixoSchema = z.object({
  categoria: z.string().trim().min(1, "Informe a categoria."),
  descricao: z.string().trim().min(1, "Descreva o custo fixo."),
  valor_mensal: z.number().nonnegative(),
  ativo: z.boolean().optional(),
});

export const UpdateCustoFixoSchema = CreateCustoFixoSchema.partial();

export type CreateLancamentoInput = z.infer<typeof CreateLancamentoSchema>;
export type UpdateLancamentoInput = z.infer<typeof UpdateLancamentoSchema>;
export type CreateCustoFixoInput = z.infer<typeof CreateCustoFixoSchema>;
export type UpdateCustoFixoInput = z.infer<typeof UpdateCustoFixoSchema>;
