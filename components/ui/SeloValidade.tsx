import { diasEntre, situacaoValidade } from "@/lib/alertas";
import { hojeBrasilia } from "@/lib/financeiro";
import { formatarData } from "@/lib/format";

interface Props {
  validade: string | null | undefined;
  /** Antecedência do aviso "vence em N dias" (padrão dos alertas: 30). */
  diasAviso?: number;
}

/** Validade de um documento com a situação ao lado: vencido (vermelho),
 * vencendo (amarelo) ou só a data quando está em dia. */
export default function SeloValidade({ validade, diasAviso = 30 }: Props) {
  if (!validade) return <span className="text-gray-400">Sem validade</span>;

  const hoje = hojeBrasilia();
  const situacao = situacaoValidade(validade, hoje, diasAviso);
  const dias = diasEntre(hoje, validade);

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span>{formatarData(validade)}</span>
      {situacao === "vencido" && <span className="badge bg-red-100 text-status-error">Vencido</span>}
      {situacao === "vencendo" && (
        <span className="badge bg-secondary-light text-brand">{dias === 0 ? "Vence hoje" : `Vence em ${dias} dia${dias === 1 ? "" : "s"}`}</span>
      )}
    </span>
  );
}
