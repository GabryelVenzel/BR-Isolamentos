"use client";

// Pilha das janelas abertas (modais e diálogos). A tecla Esc fecha só a que
// está por cima — sem isso, um Esc com dois modais empilhados (ex.: detalhe
// do serviço + "adicionar parceiro", ou qualquer modal + confirmação)
// fecharia todos de uma vez.

type AoPressionarEsc = () => void;

const pilha: AoPressionarEsc[] = [];
let ouvindo = false;

function aoTeclar(evento: KeyboardEvent) {
  if (evento.key !== "Escape" || pilha.length === 0) return;
  evento.preventDefault();
  pilha[pilha.length - 1]();
}

/** Registra uma janela no topo da pilha; devolve a função que a remove. */
export function empilharModal(aoPressionarEsc: AoPressionarEsc): () => void {
  pilha.push(aoPressionarEsc);
  if (!ouvindo) {
    document.addEventListener("keydown", aoTeclar);
    ouvindo = true;
  }
  return () => {
    const indice = pilha.lastIndexOf(aoPressionarEsc);
    if (indice !== -1) pilha.splice(indice, 1);
  };
}
