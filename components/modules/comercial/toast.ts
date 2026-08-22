"use client";

import { useEffect, useState } from "react";

// Sistema de toast mínimo, sem dependência nova — um singleton em módulo
// (lista de toasts + assinantes) em vez de um Context Provider, porque os
// disparadores ficam espalhados fundo na árvore (card do Kanban, modal de
// detalhe, painel de leads frios...) e a chamada direta `toast.sucesso(...)`
// evita passar callback por 4-5 níveis de prop drilling. `useToasts()` é o
// único ponto que qualquer componente precisa saber pra RENDERIZAR a lista
// (ver ToastContainer.tsx); pra DISPARAR um toast, qualquer lugar do módulo
// Comercial importa `toast` direto.

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

/** Hook usado só pelo ToastContainer — reflete a lista atual de toasts
 * ativos e re-renderiza quando ela muda. */
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
