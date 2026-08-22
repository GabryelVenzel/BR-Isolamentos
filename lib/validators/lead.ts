import { z } from "zod";

// Módulo Comercial (funil de leads) — o SQL já existe em
// sql-migration-004-6modulos-completo.sql (falta aplicar no Supabase e
// implementar o repositório, ver lib/contexts/comercial.ts).

const EtapaFunilSchema = z.enum(["prospeccao", "contato", "proposta", "negociacao", "fechado", "perdido"]);

export const CreateLeadSchema = z.object({
  cliente_id: z.number().int().positive(),
  etapa: EtapaFunilSchema,
  temperatura: z.enum(["frio", "morno", "quente"]),
  valor_estimado: z.number().nonnegative(),
  origem: z.string().trim().nullable().optional(),
  proxima_acao: z.string().trim().nullable().optional(),
  data_proxima_acao: z.string().datetime().nullable().optional(),
  notas: z.string().trim().nullable().optional(),
  atribuido_a: z.string().trim().email().nullable().optional(),
  tags: z.array(z.string().trim().min(1)).optional(),
});

export const UpdateLeadSchema = CreateLeadSchema.partial();

export const MoverLeadSchema = z.object({
  leadId: z.string().min(1),
  novaEtapa: EtapaFunilSchema,
});

// Mudar temperatura é uma operação separada de `atualizarLead` (como mover de
// etapa) porque tem efeito colateral: virar "frio" agenda uma reativação
// automática (ver lib/usecases/comercial/mudarTemperatura.ts). O usuário pode
// informar um prazo customizado (campo "Custom: [___] dias" do mockup) — se
// omitido, o use case usa o prazo configurado para a etapa atual do lead.
const TemperaturaSchema = z.enum(["frio", "morno", "quente"]);

export const MudarTemperaturaSchema = z.object({
  leadId: z.string().min(1),
  novaTemperatura: TemperaturaSchema,
  intervaloDiasCustom: z.number().int().positive("O prazo customizado deve ser maior que zero.").optional(),
});

export const CancelarAgendamentoFrioSchema = z.object({
  motivoCancelamento: z.string().trim().nullable().optional(),
});

export const AtualizarConfigReativacaoSchema = z.object({
  dias_prospeccao: z.number().int().positive("Deve ser maior que zero."),
  dias_contato: z.number().int().positive("Deve ser maior que zero."),
  dias_proposta: z.number().int().positive("Deve ser maior que zero."),
  dias_negociacao: z.number().int().positive("Deve ser maior que zero."),
});

export const CreateInteracaoLeadSchema = z.object({
  lead_id: z.string().min(1),
  tipo: z.enum(["nota", "email", "chamada", "reuniao", "proposta_enviada"]),
  descricao: z.string().trim().min(1, "Descreva a interação."),
  autor_email: z.string().trim().email().nullable().optional(),
  data_interacao: z.string().datetime().nullable().optional(),
});

export type CreateLeadInput = z.infer<typeof CreateLeadSchema>;
export type UpdateLeadInput = z.infer<typeof UpdateLeadSchema>;
export type MoverLeadInput = z.infer<typeof MoverLeadSchema>;
export type MudarTemperaturaInput = z.infer<typeof MudarTemperaturaSchema>;
export type CancelarAgendamentoFrioInput = z.infer<typeof CancelarAgendamentoFrioSchema>;
export type AtualizarConfigReativacaoInput = z.infer<typeof AtualizarConfigReativacaoSchema>;
export type CreateInteracaoLeadInput = z.infer<typeof CreateInteracaoLeadSchema>;
