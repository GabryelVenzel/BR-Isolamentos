import { z } from "zod";

// Schemas da calculadora rápida do módulo Engenharia (app/engenharia/page.tsx).
// Diferente do wizard de orçamento (lib/validators/orcamento.ts), aqui não há
// item de orçamento sendo montado — só os dados mínimos pro cálculo físico.
//
// Limites numéricos: propositalmente NÃO colocamos um teto fixo de
// temperatura (ex. 300°C) nos schemas — o catálogo de materiais real do
// sistema tem isolantes refratários registrados até 1400°C (ver seed em
// sql-schema.sql), um teto genérico bloquearia cálculos legítimos pro
// próprio negócio da empresa. O limite que importa de verdade é o
// (t_min, t_max) do material selecionado, checado no use case
// (lib/usecases/engenharia/calcularQuente.ts) depois de buscar o material —
// só ele sabe a faixa certa. Os `.min()/.max()` aqui embaixo são só guarda-
// -corpo contra valor fisicamente absurdo (erro de digitação tipo "2500" em
// vez de "250"), não uma regra de negócio.
//
// Mensagens de campo obrigatório: como o resto do projeto (ver
// lib/validators/cliente.ts, orcamento.ts), não customizamos a mensagem de
// "obrigatório" do Zod — o path do campo (ex. "temperatura_quente") já vem
// junto na mensagem final (lib/validators/index.ts#formatarErrosZod), então
// dá pra saber qual campo faltou sem duplicar essa lista aqui.

const GeometriaSchema = z.enum(["plana", "tubulacao"]);

export const CalcularQuenteSchema = z
  .object({
    material_id: z.number().int().positive(),
    acabamento_id: z.number().int().positive(),
    geometria: GeometriaSchema,
    diametro_mm: z.number().positive("Diâmetro deve ser maior que zero.").optional(),
    espessura_mm: z.number().positive("Espessura deve ser maior que zero."),
    temperatura_quente: z.number().min(-50).max(2000, "Temperatura acima de 2000°C — confira o valor digitado."),
    temperatura_ambiente: z.number().min(-50).max(80),
  })
  .refine((d) => d.geometria !== "tubulacao" || (d.diametro_mm ?? 0) > 0, {
    message: "Diâmetro externo do tubo é obrigatório para tubulação.",
    path: ["diametro_mm"],
  })
  .refine((d) => d.temperatura_quente > d.temperatura_ambiente, {
    message: "A temperatura quente deve ser maior que a temperatura ambiente.",
    path: ["temperatura_quente"],
  });

export const CalcularFrioSchema = z
  .object({
    material_id: z.number().int().positive(),
    geometria: GeometriaSchema,
    diametro_mm: z.number().positive("Diâmetro deve ser maior que zero.").optional(),
    // Pode ser negativa (linha de água gelada, câmara fria) — nunca validar
    // como "positive" aqui, seria fisicamente errado.
    temperatura_interna: z.number().min(-100).max(80),
    temperatura_ambiente: z.number().min(-20).max(60),
    umidade_relativa: z
      .number()
      .min(0, "Umidade relativa deve estar entre 0 e 100%.")
      .max(100, "Umidade relativa deve estar entre 0 e 100%."),
    velocidade_vento_ms: z.number().min(0, "Velocidade do vento não pode ser negativa.").default(0),
  })
  .refine((d) => d.geometria !== "tubulacao" || (d.diametro_mm ?? 0) > 0, {
    message: "Diâmetro externo do tubo é obrigatório para tubulação.",
    path: ["diametro_mm"],
  })
  .refine((d) => d.temperatura_ambiente > d.temperatura_interna, {
    message: "A temperatura ambiente deve ser maior que a temperatura interna (senão não há condensação a evitar).",
    path: ["temperatura_ambiente"],
  });

// As 7 opções já existentes em lib/calculadora-termica.ts (COMBUSTIVEIS) —
// mantidas todas aqui (não só as 4 do pedido original) porque a tabela já é
// validada e reaproveitada tal como está, ver lib/usecases/engenharia/calcularEconomia.ts.
const CombustivelSchema = z.enum([
  "vapor",
  "eletricidade",
  "gas_natural",
  "glp",
  "oleo_diesel",
  "oleo_bpf",
  "lenha_eucalipto",
]);

export const CalcularEconomiaSchema = z.object({
  perda_com_isolante_kw_m2: z.number(),
  perda_sem_isolante_kw_m2: z.number(),
  area_m2: z.number().positive("Área é obrigatória para calcular a economia."),
  combustivel: CombustivelSchema,
  custo_combustivel: z.number().positive("Preço do combustível deve ser maior que zero."),
  eficiencia_percentual: z.number().gt(0, "Eficiência deve estar entre 0 e 100%.").max(100, "Eficiência deve estar entre 0 e 100%."),
  horas_operacao_ano: z.number().gt(0).max(8760, "Não pode passar de 8760h (24h × 365 dias)."),
  valor_investimento: z.number().positive().optional(),
});

export type CalcularQuenteInput = z.infer<typeof CalcularQuenteSchema>;
export type CalcularFrioInput = z.infer<typeof CalcularFrioSchema>;
export type CalcularEconomiaInput = z.infer<typeof CalcularEconomiaSchema>;
