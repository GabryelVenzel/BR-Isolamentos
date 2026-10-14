/** Esqueleto de carregamento (revisão de usabilidade) — blocos cinza no
 * formato do conteúdo, no lugar do texto "Carregando...": a tela não "pula"
 * quando os dados chegam e dá para perceber o que vem ali. */

export function BlocoEsqueleto({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-input bg-gray-200/70 ${className}`} aria-hidden />;
}

/** Lista/tabela carregando: N linhas. */
export function EsqueletoLista({ linhas = 5 }: { linhas?: number }) {
  return (
    <div className="card space-y-3" role="status" aria-label="Carregando">
      {Array.from({ length: linhas }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <BlocoEsqueleto className="h-4 w-24" />
          <BlocoEsqueleto className="h-4 flex-1" />
          <BlocoEsqueleto className="hidden h-4 w-28 sm:block" />
        </div>
      ))}
    </div>
  );
}

/** Bloco de conteúdo (formulário, ficha) carregando. */
export function EsqueletoCartao({ linhas = 4 }: { linhas?: number }) {
  return (
    <div className="card space-y-3" role="status" aria-label="Carregando">
      <BlocoEsqueleto className="h-5 w-1/3" />
      {Array.from({ length: linhas }).map((_, i) => (
        <BlocoEsqueleto key={i} className={`h-4 ${i % 2 ? "w-2/3" : "w-full"}`} />
      ))}
    </div>
  );
}

/** Texto curto de carregamento dentro de um bloco já desenhado (substitui o
 * "Carregando..." solto). */
export function Carregando({ linhas = 3 }: { linhas?: number }) {
  return (
    <div className="space-y-2 py-1" role="status" aria-label="Carregando">
      {Array.from({ length: linhas }).map((_, i) => (
        <BlocoEsqueleto key={i} className={`h-4 ${i === linhas - 1 ? "w-1/2" : "w-full"}`} />
      ))}
    </div>
  );
}
