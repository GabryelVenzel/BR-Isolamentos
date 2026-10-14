"use client";

import { useEffect, useRef, useState } from "react";

/** Estado que o navegador lembra entre visitas (revisão de usabilidade) —
 * usado para os filtros de cada tela: ao voltar, a tela abre como você
 * deixou. Fica só neste navegador; se o armazenamento local não estiver
 * disponível, funciona como um estado comum. */
export function useEstadoLembrado<T>(chave: string, inicial: T): [T, (valor: T | ((anterior: T) => T)) => void] {
  const [valor, setValor] = useState<T>(inicial);
  const carregado = useRef(false);

  useEffect(() => {
    try {
      const salvo = window.localStorage.getItem(`br-isolamentos:${chave}`);
      if (salvo !== null) {
        const lido = JSON.parse(salvo);
        // Objeto: completa com os campos novos do valor inicial.
        setValor(lido && typeof lido === "object" && !Array.isArray(lido) && typeof inicial === "object" ? { ...inicial, ...lido } : lido);
      }
    } catch {
      // armazenamento indisponível — segue com o inicial
    }
    carregado.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  useEffect(() => {
    if (!carregado.current) return;
    try {
      window.localStorage.setItem(`br-isolamentos:${chave}`, JSON.stringify(valor));
    } catch {
      // ignora
    }
  }, [chave, valor]);

  return [valor, setValor];
}
