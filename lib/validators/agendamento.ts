import { z } from "zod";

export const CreateAgendamentoSchema = z.object({
  orcamento_id: z.number().int().positive().nullable().optional(),
  data_inicio: z.string().min(1, "Informe a data de início."),
  data_fim: z.string().nullable().optional(),
  parceiros_alocados: z.array(z.string().uuid()).optional(),
  status: z.enum(["agendado", "em_progresso", "concluido", "cancelado"]).optional(),
  local: z.string().trim().nullable().optional(),
  notas: z.string().trim().nullable().optional(),
  horas_estimadas: z.number().nonnegative().nullable().optional(),
  horas_reais: z.number().nonnegative().nullable().optional(),
});

export const UpdateAgendamentoSchema = CreateAgendamentoSchema.partial();

export const AtualizarStatusAgendamentoSchema = z.object({
  status: z.enum(["agendado", "em_progresso", "concluido", "cancelado"]),
  horas_reais: z.number().nonnegative().nullable().optional(),
});

export type CreateAgendamentoInput = z.infer<typeof CreateAgendamentoSchema>;
export type UpdateAgendamentoInput = z.infer<typeof UpdateAgendamentoSchema>;
export type AtualizarStatusAgendamentoInput = z.infer<typeof AtualizarStatusAgendamentoSchema>;
