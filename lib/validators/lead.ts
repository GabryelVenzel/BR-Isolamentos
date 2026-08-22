import { z } from "zod";

// Módulo Comercial (funil de leads) ainda não tem tabela no Supabase — schema
// já preparado para quando `lib/contexts/comercial.ts` sair do estágio de
// scaffolding (ver comentário no topo daquele arquivo).

export const CreateLeadSchema = z.object({
  cliente_id: z.number().int().positive(),
  etapa: z.enum(["prospeccao", "contato", "proposta", "negociacao", "fechado"]),
  temperatura: z.enum(["frio", "morno", "quente"]),
  valor_estimado: z.number().nonnegative(),
  proxima_acao: z.string().trim().nullable().optional(),
  data_proxima_acao: z.string().datetime().nullable().optional(),
});

export const MoverLeadSchema = z.object({
  leadId: z.string().min(1),
  novaEtapa: z.enum(["prospeccao", "contato", "proposta", "negociacao", "fechado"]),
});

export type CreateLeadInput = z.infer<typeof CreateLeadSchema>;
export type MoverLeadInput = z.infer<typeof MoverLeadSchema>;
