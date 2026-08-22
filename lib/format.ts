// Helpers de formatação usados em toda a UI (pt-BR).

export function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);
}

export function formatarNumero(valor: number, casasDecimais = 2): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: casasDecimais,
    maximumFractionDigits: casasDecimais,
  }).format(valor);
}

// Datas "puras" (YYYY-MM-DD, sem hora — como vêm de colunas `date` do
// Postgres: agendamentos.data_inicio, lancamentos_financeiros.data, etc.) não
// podem passar por `new Date(string)` direto: o JS interpreta esse formato
// como UTC meia-noite, e o Intl.DateTimeFormat later formata no fuso local —
// em fusos negativos (America/Sao_Paulo, UTC-3) isso exibe o dia anterior.
// Construir a data a partir dos componentes Y/M/D evita o deslocamento.
// Timestamps completos (criado_em, data_criacao...) continuam com o parsing
// padrão, que já reflete corretamente o instante real no fuso local.
function parseDataLocal(valor: string): Date {
  const somenteData = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (somenteData) {
    const [, ano, mes, dia] = somenteData;
    return new Date(Number(ano), Number(mes) - 1, Number(dia));
  }
  return new Date(valor);
}

export function formatarData(data: string | Date): string {
  const d = typeof data === "string" ? parseDataLocal(data) : data;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(d);
}

export function formatarDataHora(data: string | Date): string {
  const d = typeof data === "string" ? parseDataLocal(data) : data;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(d);
}

const STATUS_LABELS: Record<string, string> = {
  rascunho: "Rascunho",
  proposta: "Proposta",
  enviado: "Enviado",
  aceito: "Aceito",
  rejeitado: "Rejeitado",
};

export function formatarStatus(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

// Cores de status seguindo a paleta da marca (ver tailwind.config.ts):
// verde = fechado/sucesso, amarelo = pendente/aguardando ação, azul marinho
// (tint claro) = em elaboração, vermelho = recusado, cinza = neutro/rascunho.
// Usar sempre junto da classe `.badge` (app/globals.css) para a forma da pílula.
const STATUS_CLASSES: Record<string, string> = {
  rascunho: "bg-gray-100 text-gray-700",
  proposta: "bg-brand-light text-brand",
  enviado: "bg-secondary-light text-brand",
  aceito: "bg-accent-light text-accent-dark",
  rejeitado: "bg-red-100 text-status-error",
};

export function classesStatus(status: string): string {
  return STATUS_CLASSES[status] ?? "bg-gray-100 text-gray-700";
}

// --- Módulo Comercial (funil de leads) ---

const ETAPA_LABELS: Record<string, string> = {
  prospeccao: "Prospecção",
  contato: "Contato",
  proposta: "Proposta",
  negociacao: "Negociação",
  fechado: "Fechado",
  perdido: "Perdido",
};

export function formatarEtapa(etapa: string): string {
  return ETAPA_LABELS[etapa] ?? etapa;
}

const TEMPERATURA_LABELS: Record<string, string> = {
  frio: "Frio",
  morno: "Morno",
  quente: "Quente",
};

export function formatarTemperatura(temperatura: string): string {
  return TEMPERATURA_LABELS[temperatura] ?? temperatura;
}

// Frio = informativo (azul), morno = atenção (amarelo), quente = urgência (vermelho) —
// única exceção da paleta em que vermelho não significa "erro", e sim "esfria rápido,
// aja logo". Usar com a classe `.badge`.
const TEMPERATURA_CLASSES: Record<string, string> = {
  frio: "bg-brand-light text-brand",
  morno: "bg-secondary-light text-brand",
  quente: "bg-red-100 text-status-error",
};

export function classesTemperatura(temperatura: string): string {
  return TEMPERATURA_CLASSES[temperatura] ?? "bg-gray-100 text-gray-700";
}

// --- Módulo Operacional (agenda) ---

const STATUS_AGENDAMENTO_LABELS: Record<string, string> = {
  agendado: "Agendado",
  em_progresso: "Em progresso",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

export function formatarStatusAgendamento(status: string): string {
  return STATUS_AGENDAMENTO_LABELS[status] ?? status;
}

const STATUS_AGENDAMENTO_CLASSES: Record<string, string> = {
  agendado: "bg-brand-light text-brand",
  em_progresso: "bg-secondary-light text-brand",
  concluido: "bg-accent-light text-accent-dark",
  cancelado: "bg-red-100 text-status-error",
};

export function classesStatusAgendamento(status: string): string {
  return STATUS_AGENDAMENTO_CLASSES[status] ?? "bg-gray-100 text-gray-700";
}
