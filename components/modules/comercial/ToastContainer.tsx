"use client";

import { toast, useToasts, type TipoToast } from "./toast";

const CLASSES_POR_TIPO: Record<TipoToast, string> = {
  sucesso: "border-l-accent bg-accent-light/90 text-accent-dark",
  erro: "border-l-status-error bg-red-50 text-status-error",
  aviso: "border-l-secondary bg-secondary-light/90 text-brand",
  info: "border-l-brand bg-brand-light/90 text-brand",
};

const ICONE_POR_TIPO: Record<TipoToast, string> = {
  sucesso: "✅",
  erro: "⚠️",
  aviso: "⏳",
  info: "ℹ️",
};

/** Fica montado uma vez no topo de app/comercial/page.tsx — os disparos
 * (`toast.sucesso(...)` etc, ver toast.ts) podem vir de qualquer componente
 * do módulo, mesmo bem aninhado, sem prop drilling. */
export default function ToastContainer() {
  const toasts = useToasts();
  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[70] flex w-full max-w-sm flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-2 rounded-card border-l-4 p-3 text-sm shadow-card-hover ${CLASSES_POR_TIPO[t.tipo]}`}
        >
          <span aria-hidden>{ICONE_POR_TIPO[t.tipo]}</span>
          <p className="flex-1">{t.mensagem}</p>
          <button type="button" className="text-xs opacity-60 hover:opacity-100" onClick={() => toast.remover(t.id)}>
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
