/** Texto de apoio recolhido: fica como um link discreto ("Como funciona") e
 * só abre se a pessoa quiser ler — para as telas não carregarem parágrafos
 * de explicação o tempo todo. */
export default function Explicacao({ titulo = "Como funciona", children }: { titulo?: string; children: React.ReactNode }) {
  return (
    <details className="text-xs text-gray-500">
      <summary className="cursor-pointer select-none text-brand hover:underline">{titulo}</summary>
      <div className="mt-1 space-y-1 leading-relaxed">{children}</div>
    </details>
  );
}
