"use client";

interface Props<T extends string> {
  /** Etapa atual do cartão — fica fora da lista de destinos. */
  atual: T;
  opcoes: Array<{ valor: T; label: string }>;
  onMover: (destino: T) => void;
  /** Nome do item, só para o leitor de tela ("Mover L00012 para..."). */
  rotuloItem: string;
}

/** Seletor "Mover para..." de um cartão de Kanban — alternativa a arrastar,
 * e o único jeito de mudar de etapa em tela de toque (o arrastar nativo do
 * navegador não funciona no celular). Fica dentro do cartão clicável, então
 * segura o clique pra não abrir o detalhe junto. */
export default function MoverPara<T extends string>({ atual, opcoes, onMover, rotuloItem }: Props<T>) {
  return (
    <select
      aria-label={`Mover ${rotuloItem} para outra etapa`}
      value=""
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        if (e.target.value) onMover(e.target.value as T);
      }}
      className="mt-2 w-full cursor-pointer rounded-input border border-gray-200 bg-gray-50 px-2 py-1 font-montserrat text-xs font-semibold text-brand hover:border-brand focus:border-brand focus:outline-none"
    >
      <option value="">Mover para...</option>
      {opcoes
        .filter((o) => o.valor !== atual)
        .map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.label}
          </option>
        ))}
    </select>
  );
}
