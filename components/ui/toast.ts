"use client";

import { useEffect, useState } from "react";

// Avisos rápidos (toasts) do sistema — UMA lista global e um único
// `<ToastContainer />` montado no layout raiz. Antes cada módulo tinha sua
// própria cópia (lista + container), e um aviso disparado por um componente
// de outro módulo (ex.: "Serviço criado", emitido pelo modal de Operacional
// aberto dentro do Comercial) não aparecia, porque a tela só renderizava o
// container do próprio módulo. Os arquivos `components/modules/*/toast.ts`
// continuam existindo só como reexportação deste.

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
  // Erros ficam mais tempo na tela — costumam trazer uma instrução.
  setTimeout(() => remover(item.id), tipo === "erro" ? 7000 : 4000);
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
