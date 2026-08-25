import { z } from "zod";

const TipoTrabalhoOperacionalSchema = z.enum([
  "bancada",
  "caldeiraria",
  "isolamentos_removiveis",
  "isolamentos_fixos",
]);

const EtapaServicoSchema = z.enum(["planejamento", "execucao", "finalizado"]);

// Criado a partir de um lead fechado (NovoServicoModal.tsx) — lead_id e
// orcamento_id são obrigatórios (regra do pedido: "Orçamento obrigatório,
// não pode deixar vazio"), cliente_id/valor_orcado/numero_lead/
// numero_orcamento são preenchidos pelo use case a partir do lead/orçamento
// vinculado, não pedidos ao usuário de novo.
export const CreateServicoSchema = z
  .object({
    lead_id: z.string().min(1, "Serviço precisa de um lead vinculado."),
    orcamento_id: z.number().int().positive("Serviço precisa de um orçamento vinculado."),
    // Um serviço pode ter mais de um tipo de trabalho executado ao mesmo
    // tempo (ex.: Caldeiraria + Isolamentos no mesmo local/dia) — `tipo_trabalho`
    // (singular) é mantido só como espelho do primeiro item de
    // `tipos_trabalho`, para não quebrar filtros/relatórios que ainda
    // agrupam por um tipo só (ver decisão em sql-migration-011).
    tipos_trabalho: z.array(TipoTrabalhoOperacionalSchema).min(1, "Selecione ao menos 1 tipo de trabalho."),
    parceiro_principal_id: z.string().min(1, "Selecione o parceiro principal."),
    pessoas_alocadas: z.number().int().positive().nullable().optional(),
    parceiros_alocados: z.array(z.string().min(1)).optional(),
    data_inicio: z.string().min(1, "Informe a data de início."),
    data_fim_prevista: z.string().nullable().optional(),
    descricao: z.string().trim().nullable().optional(),
    notas: z.string().trim().nullable().optional(),
    responsavel_email: z.string().trim().email().nullable().optional(),
  })
  .refine(
    (d) => !d.data_fim_prevista || d.data_fim_prevista >= d.data_inicio,
    { message: "A data fim prevista não pode ser anterior à data de início.", path: ["data_fim_prevista"] }
  );

// Campos editáveis depois de criado — sem lead_id/orcamento_id (vínculo é
// fixado na criação, igual `origem` do lead no módulo Comercial) nem etapa
// (que passa por moverServico, com histórico) nem valor_real/data_fim_real/
// anexos (que passam por finalizarServico, com validação de checklist).
export const UpdateServicoSchema = z.object({
  tipos_trabalho: z.array(TipoTrabalhoOperacionalSchema).min(1).optional(),
  parceiro_principal_id: z.string().min(1).optional(),
  pessoas_alocadas: z.number().int().positive().nullable().optional(),
  parceiros_alocados: z.array(z.string().min(1)).optional(),
  data_inicio: z.string().min(1).optional(),
  data_fim_prevista: z.string().nullable().optional(),
  descricao: z.string().trim().nullable().optional(),
  notas: z.string().trim().nullable().optional(),
  responsavel_email: z.string().trim().email().nullable().optional(),
  valor_orcado: z.number().nonnegative().optional(),
});

export const MoverServicoSchema = z.object({
  servicoId: z.string().min(1),
  novaEtapa: EtapaServicoSchema,
});

// Finalização: valor_real é obrigatório aqui (o checklist de finalização
// também exige foto_principal_url/pdf_relatorio_url, mas esses já estarão
// gravados no serviço antes de chegar aqui — ver
// lib/usecases/operacional/finalizarServico.ts, que checa os 4 requisitos
// juntos, não só o que este schema valida).
export const FinalizarServicoSchema = z.object({
  valor_real: z.number().nonnegative("Informe o valor real do serviço."),
  data_fim_real: z.string().nullable().optional(),
});

export const AnexarArquivoServicoSchema = z.object({
  campo: z.enum(["foto_principal_url", "pdf_relatorio_url", "fotos_url"]),
  url: z.string().trim().min(1, "URL do arquivo não pode ser vazia."),
});

// `url` só é obrigatória pra remover de `fotos_url` (array — precisa saber
// QUAL das fotos remover); foto_principal_url/pdf_relatorio_url são um
// único valor cada, então remover é só limpar pra null.
export const RemoverArquivoServicoSchema = z
  .object({
    campo: z.enum(["foto_principal_url", "pdf_relatorio_url", "fotos_url"]),
    url: z.string().trim().min(1).optional(),
  })
  .refine((d) => d.campo !== "fotos_url" || !!d.url, {
    message: "Informe a URL da foto a remover.",
    path: ["url"],
  });

export const CreateInteracaoServicoSchema = z.object({
  servico_id: z.string().min(1),
  tipo: z.enum(["nota", "foto", "chamada", "email", "reuniao"]),
  descricao: z.string().trim().min(1, "Descreva a interação."),
  autor_email: z.string().trim().email().nullable().optional(),
});

export type CreateServicoInput = z.infer<typeof CreateServicoSchema>;
export type UpdateServicoInput = z.infer<typeof UpdateServicoSchema>;
export type MoverServicoInput = z.infer<typeof MoverServicoSchema>;
export type FinalizarServicoInput = z.infer<typeof FinalizarServicoSchema>;
export type AnexarArquivoServicoInput = z.infer<typeof AnexarArquivoServicoSchema>;
export type RemoverArquivoServicoInput = z.infer<typeof RemoverArquivoServicoSchema>;
export type CreateInteracaoServicoInput = z.infer<typeof CreateInteracaoServicoSchema>;
