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

export function formatarData(data: string | Date): string {
  const d = typeof data === "string" ? new Date(data) : data;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(d);
}

export function formatarDataHora(data: string | Date): string {
  const d = typeof data === "string" ? new Date(data) : data;
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

const STATUS_CLASSES: Record<string, string> = {
  rascunho: "bg-gray-100 text-gray-700",
  proposta: "bg-blue-100 text-blue-700",
  enviado: "bg-amber-100 text-amber-700",
  aceito: "bg-accent-light text-accent-dark",
  rejeitado: "bg-red-100 text-red-700",
};

export function classesStatus(status: string): string {
  return STATUS_CLASSES[status] ?? "bg-gray-100 text-gray-700";
}
