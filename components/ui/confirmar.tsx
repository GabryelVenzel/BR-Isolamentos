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

/** Uma alternativa de `escolher()` — vira um botão do diálogo. */
export interface OpcaoEscolha<T extends string> {
  valor: T;
  label: string;
  perigo?: boolean;
}

interface Pedido extends OpcoesConfirmar {
  mensagem: string;
  /** Presente só em `escolher()`: botões no lugar do "Confirmar" único. */
  alternativas?: Array<OpcaoEscolha<string>>;
  /** `null` = cancelou; em `confirmar()` o valor de confirmação é "sim". */
  resolver: (escolha: string | null) => void;
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
    abrir({ mensagem, resolver: (escolha) => resolver(escolha === "sim"), ...opcoes });
  });
}

/** Como `confirmar`, mas com mais de um caminho além de cancelar — ex.:
 * "Só esta parcela" / "Esta e as próximas". Devolve o `valor` do botão
 * escolhido, ou `null` se a pessoa cancelou (botão Cancelar ou Esc). */
export function escolher<T extends string>(
  mensagem: string,
  alternativas: Array<OpcaoEscolha<T>>,
  opcoes: Pick<OpcoesConfirmar, "titulo" | "cancelarLabel"> = {}
): Promise<T | null> {
  return new Promise((resolver) => {
    if (!abrir) {
      resolver(null);
      return;
    }
    abrir({ mensagem, alternativas, resolver: (escolha) => resolver(escolha as T | null), ...opcoes });
  });
}

export default function ConfirmarHost() {
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const botaoCancelar = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    abrir = (novo) =>
      setPedido((atual) => {
        // Um pedido novo enquanto outro está aberto cancela o anterior.
        atual?.resolver(null);
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
    return empilharModal(() => responder(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido]);

  function responder(escolha: string | null) {
    setPedido((atual) => {
      atual?.resolver(escolha);
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
        className={`w-full rounded-card bg-white p-6 shadow-card-hover ${pedido.alternativas ? "max-w-md" : "max-w-sm"}`}
      >
        <h2 id="confirmar-titulo" className="mb-2 font-montserrat text-lg font-bold text-brand">
          {pedido.titulo ?? "Confirmar"}
        </h2>
        <p id="confirmar-mensagem" className="text-sm text-gray-700">
          {pedido.mensagem}
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button ref={botaoCancelar} type="button" className="btn-secondary" onClick={() => responder(null)}>
            {pedido.alternativas ? pedido.cancelarLabel ?? "Cancelar" : cancelarLabel}
          </button>
          {pedido.alternativas ? (
            pedido.alternativas.map((alternativa) => (
              <button
                key={alternativa.valor}
                type="button"
                className={alternativa.perigo ? "btn-danger" : "btn-primary"}
                onClick={() => responder(alternativa.valor)}
              >
                {alternativa.label}
              </button>
            ))
          ) : (
            <button type="button" className={perigo ? "btn-danger" : "btn-primary"} onClick={() => responder("sim")}>
              {confirmarLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
