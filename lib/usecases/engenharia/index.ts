// calcularTermico/quantificar: usados pelo wizard de orçamento (Novo
// Orçamento) — ver app/api/calcular-termico e app/api/quantificar.
export { calcularTermico } from "./calcularTermico";
export { quantificar } from "./quantificar";

// calcularQuente/calcularFrio/calcularEconomia: usados pela calculadora
// rápida standalone do módulo Engenharia (app/engenharia/page.tsx) — ver
// app/api/engenharia/*. Não reaproveitam calcularTermico porque o painel
// Quente da calculadora rápida tem uma regra própria (sem campo de vento,
// sempre 0 — ver calcularQuente.ts) que não deve afetar o wizard.
export { calcularEconomia } from "./calcularEconomia";
export type { ResultadoEconomia } from "./calcularEconomia";
export { calcularFrio } from "./calcularFrio";
export type { ResultadoFrio } from "./calcularFrio";
export { calcularQuente } from "./calcularQuente";
export type { ResultadoQuente } from "./calcularQuente";
