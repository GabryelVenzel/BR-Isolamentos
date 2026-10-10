"use client";

import { useEffect, useRef } from "react";
import { confirmar } from "./confirmar";
import { empilharModal } from "./pilha-modais";

interface Props {
  onFechar: () => void;
}

/** Comportamento padrão de fechamento de um modal — renderizado como
 * primeiro filho do fundo (`fixed inset-0`) do modal:
 *
 *   - clicar fora NÃO fecha (o fundo não tem mais onClick);
 *   - Esc fecha, só o modal que está por cima;
 *   - se algo foi digitado/alterado dentro do modal, Esc pergunta antes de
 *     descartar. O botão "Cancelar" continua fechando direto — ali a
 *     intenção de sair já é explícita.
 *
 * "Algo foi alterado" é detectado pelos eventos `input`/`change` que sobem
 * dos campos até o fundo do modal — não exige que cada formulário informe
 * seu estado. */
export default function FecharComEsc({ onFechar }: Props) {
  const marcador = useRef<HTMLSpanElement>(null);
  const alterado = useRef(false);
  const perguntando = useRef(false);
  const fechar = useRef(onFechar);
  fechar.current = onFechar;

  useEffect(() => {
    const fundo = marcador.current?.parentElement;
    const marcarAlterado = () => {
      alterado.current = true;
    };
    fundo?.addEventListener("input", marcarAlterado);
    fundo?.addEventListener("change", marcarAlterado);

    const desempilhar = empilharModal(async () => {
      if (perguntando.current) return;
      if (alterado.current) {
        perguntando.current = true;
        const descartar = await confirmar("Descartar o que foi preenchido?", {
          titulo: "Fechar sem salvar",
          confirmarLabel: "Descartar",
          cancelarLabel: "Continuar editando",
        });
        perguntando.current = false;
        if (!descartar) return;
      }
      fechar.current();
    });

    return () => {
      fundo?.removeEventListener("input", marcarAlterado);
      fundo?.removeEventListener("change", marcarAlterado);
      desempilhar();
    };
  }, []);

  return <span ref={marcador} hidden />;
}
