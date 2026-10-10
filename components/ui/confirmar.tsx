"use client";

import { useEffect, useRef, useState } from "react";
import { empilharModal } from "./pilha-modais";

// Diálogo de confirmação do sistema — substitui o `confirm()` nativo do
// navegador. Uso (dentro de uma função async):
//
//   if (!(await confirmar(`Excluir o fornecedor "${nome}"?`))) return;
//
// `<ConfirmarHost />` fica montado uma única vez no layout raiz.

export interface OpcoesConfirmar {
  titulo?: string;
  /** Rótulo do botão de confirmação. Padrão: deduzido da mensagem
   * ("Excluir...", "Remover...", "Descartar...") ou "Confirmar". */
  confirmarLabel?: string;
  cancelarLabel?: string;
  /** Botão vermelho. Padrão: verdadeiro quando a ação é excluir/remover/descartar. */
  perigo?: boolean;
}

interface Pedido extends OpcoesConfirmar {
  mensagem: string;
  resolver: (confirmado: boolean) => void;
}

let abrir: ((pedido: Pedido) => void) | null = null;

const VERBOS_DE_PERIGO = ["Excluir", "Remover", "Descartar", "Cancelar", "Desativar"];

export function confirmar(mensagem: string, opcoes: OpcoesConfirmar = {}): Promise<boolean> {
  return new Promise((resolver) => {
    // Sem o host montado (não deveria acontecer), cai no diálogo do navegador
    // em vez de executar uma exclusão sem perguntar.
    if (!abrir) {
      resolver(window.confirm(mensagem));
      return;
    }
    abrir({ mensagem, resolver, ...opcoes });
  });
}

export default function ConfirmarHost() {
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const botaoCancelar = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    abrir = (novo) =>
      setPedido((atual) => {
        // Um pedido novo enquanto outro está aberto cancela o anterior.
        atual?.resolver(false);
        return novo;
      });
    return () => {
      abrir = null;
    };
  }, []);

  useEffect(() => {
    if (!pedido) return;
    // Foco no "Cancelar": Enter por reflexo não confirma uma exclusão.
    botaoCancelar.current?.focus();
    return empilharModal(() => responder(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido]);

  function responder(confirmado: boolean) {
    setPedido((atual) => {
      atual?.resolver(confirmado);
      return null;
    });
  }

  if (!pedido) return null;

  const verbo = VERBOS_DE_PERIGO.find((v) => pedido.mensagem.startsWith(v));
  const perigo = pedido.perigo ?? Boolean(verbo);
  // "Cancelar este agendamento?" não pode ter um botão "Cancelar" de cada lado.
  const confirmarLabel = pedido.confirmarLabel ?? (verbo && verbo !== "Cancelar" ? verbo : "Confirmar");
  const cancelarLabel = pedido.cancelarLabel ?? (verbo === "Cancelar" ? "Voltar" : "Cancelar");

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-brand/60 p-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirmar-titulo"
        aria-describedby="confirmar-mensagem"
        className="w-full max-w-sm rounded-card bg-white p-6 shadow-card-hover"
      >
        <h2 id="confirmar-titulo" className="mb-2 font-montserrat text-lg font-bold text-brand">
          {pedido.titulo ?? "Confirmar"}
        </h2>
        <p id="confirmar-mensagem" className="text-sm text-gray-700">
          {pedido.mensagem}
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button ref={botaoCancelar} type="button" className="btn-secondary" onClick={() => responder(false)}>
            {cancelarLabel}
          </button>
          <button type="button" className={perigo ? "btn-danger" : "btn-primary"} onClick={() => responder(true)}>
            {confirmarLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
