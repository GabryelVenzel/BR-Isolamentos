import { formatarMoeda, formatarNumero } from "@/lib/format";
import type { MaoObraEquipe } from "@/lib/types";
import { LABEL_FORMA_CONTRATACAO, LABEL_FUNCAO_MAO_OBRA } from "@/lib/usecases/orcamento";

/** Equipe salva/calculada, só leitura (migração 056): cada linha com a forma
 * de contratação, o que as pessoas recebem e os encargos; no fim, valor pago,
 * encargos e custo real. Uso interno — a proposta ao cliente não mostra nada
 * disso. */
export default function ResumoEquipe({ equipe }: { equipe: MaoObraEquipe }) {
  return (
    <div className="space-y-1">
      {equipe.funcoes.map((f, i) => (
        <div key={f.id ?? `${f.funcao}-${i}`} className="flex justify-between gap-4">
          <span>
            {LABEL_FUNCAO_MAO_OBRA[f.funcao]}
            {f.forma && <span className="text-gray-500"> ({LABEL_FORMA_CONTRATACAO[f.forma]})</span>}: {f.pessoas} × {f.diarias}{" "}
            {f.diarias === 1 ? "diária" : "diárias"} × {formatarMoeda(f.valor_diaria)}
            {(f.encargos ?? 0) > 0 && (
              <span className="block text-xs text-gray-500">
                pago {formatarMoeda(f.valor_pago ?? 0)}
                {(f.inss ?? 0) > 0 && ` · INSS ${formatarMoeda(f.inss ?? 0)}`}
                {(f.irrf ?? 0) > 0 && ` · IR ${formatarMoeda(f.irrf ?? 0)}`}
                {(f.iss ?? 0) > 0 && ` · ISS ${formatarMoeda(f.iss ?? 0)}`}
                {(f.cpp ?? 0) > 0 && ` · patronal ${formatarMoeda(f.cpp ?? 0)}`}
              </span>
            )}
          </span>
          <span className="shrink-0">{formatarMoeda(f.subtotal)}</span>
        </div>
      ))}
      {equipe.encargos_total != null && (
        <div className="space-y-0.5 border-t border-gray-100 pt-1 text-gray-600">
          <div className="flex justify-between">
            <span>Valor pago às pessoas</span>
            <span>{formatarMoeda(equipe.valor_pago_pessoas ?? 0)}</span>
          </div>
          <div className="flex justify-between">
            <span>Encargos sobre a mão de obra</span>
            <span>{formatarMoeda(equipe.encargos_total)}</span>
          </div>
        </div>
      )}
      <p className="border-t border-gray-100 pt-1 text-gray-500">
        {formatarNumero(equipe.horas_obra, 1)} h de obra ÷ {formatarNumero(equipe.horas_uteis_dia, 1)} h úteis por dia ={" "}
        <strong className="text-gray-800">
          {equipe.dias} {equipe.dias === 1 ? "dia" : "dias"} de obra
        </strong>
        {equipe.dias_manual ? " (ajuste manual)" : ""} · custo da equipe: {formatarMoeda(equipe.valor_total)}
      </p>
    </div>
  );
}
