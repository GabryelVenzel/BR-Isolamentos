"use client";

import { useEffect, useState } from "react";

// Mesmo sistema de toast mínimo do módulo Comercial (ver
// components/modules/comercial/toast.ts) — duplicado aqui de propósito, não
// importado de lá: cada módulo mantém seus componentes autocontidos, sem
// import cruzado entre pastas de módulo por uma dependência tão pequena.

export type TipoToast = "sucesso" | "erro" | "aviso" | "info";

export interface ToastItem {
  id: number;
  tipo: TipoToast;
  mensagem: string;
}

let proximoId = 1;
let toasts: ToastItem[] = [];
const assinantes = new Set<() => void>();

function notificar() {
  for (const fn of assinantes) fn();
}

function adicionar(tipo: TipoToast, mensagem: string) {
  const item: ToastItem = { id: proximoId++, tipo, mensagem };
  toasts = [...toasts, item];
  notificar();
  setTimeout(() => remover(item.id), 4000);
}

function remover(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  notificar();
}

export const toast = {
  sucesso: (mensagem: string) => adicionar("sucesso", mensagem),
  erro: (mensagem: string) => adicionar("erro", mensagem),
  aviso: (mensagem: string) => adicionar("aviso", mensagem),
  info: (mensagem: string) => adicionar("info", mensagem),
  remover,
};

export function useToasts(): ToastItem[] {
  const [estado, setEstado] = useState(toasts);

  useEffect(() => {
    const atualizar = () => setEstado(toasts);
    assinantes.add(atualizar);
    atualizar();
    return () => {
      assinantes.delete(atualizar);
    };
  }, []);

  return estado;
}
