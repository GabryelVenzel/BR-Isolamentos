"use client";

import { AlertTriangle, CheckCircle2, Clock, Info, X, type LucideIcon } from "lucide-react";
import { toast, useToasts, type TipoToast } from "./toast";

const CLASSES_POR_TIPO: Record<TipoToast, string> = {
  sucesso: "border-l-accent bg-accent-light text-accent-dark",
  erro: "border-l-status-error bg-red-50 text-status-error",
  aviso: "border-l-secondary bg-secondary-light text-brand",
  info: "border-l-brand bg-brand-light text-brand",
};

const ICONE_POR_TIPO: Record<TipoToast, LucideIcon> = {
  sucesso: CheckCircle2,
  erro: AlertTriangle,
  aviso: Clock,
  info: Info,
};

/** Container único de avisos — montado no layout raiz (app/layout.tsx).
 * `z-[110]`: acima de modais e do diálogo de confirmação. */
export default function ToastContainer() {
  const toasts = useToasts();

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed right-4 top-4 z-[110] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2"
    >
      {toasts.map((t) => {
        const Icone = ICONE_POR_TIPO[t.tipo];
        return (
          <div
            key={t.id}
            role={t.tipo === "erro" ? "alert" : "status"}
            className={`pointer-events-auto flex items-start gap-2 rounded-card border-l-4 p-3 text-sm shadow-card-hover ${CLASSES_POR_TIPO[t.tipo]}`}
          >
            <Icone className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p className="flex-1">{t.mensagem}</p>
            <button
              type="button"
              aria-label="Fechar aviso"
              className="opacity-60 hover:opacity-100"
              onClick={() => toast.remover(t.id)}
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        );
      })}
    </div>
  );
}
