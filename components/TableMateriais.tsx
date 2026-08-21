import { formatarNumero } from "@/lib/format";
import type { QuantificarResultado } from "@/lib/types";

interface Props {
  quantificacao: QuantificarResultado;
}

const LINHAS: Array<{ campo: keyof QuantificarResultado; label: string; unidade: string }> = [
  { campo: "manta_kg", label: "Manta isolante", unidade: "kg" },
  { campo: "chapa_kg", label: "Chapa de acabamento", unidade: "kg" },
  { campo: "rebites", label: "Rebites", unidade: "un" },
  { campo: "parafusos", label: "Parafusos", unidade: "un" },
  { campo: "arame_kg", label: "Arame de amarração", unidade: "kg" },
  { campo: "vedacao_pu", label: "Vedação P.U.", unidade: "un" },
  { campo: "vedacit_un", label: "Vedacit (latas 360g)", unidade: "un" },
];

export default function TableMateriais({ quantificacao }: Props) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
          <tr>
            <th className="px-4 py-3">Material</th>
            <th className="px-4 py-3 text-right">Quantidade</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {LINHAS.map((linha) => (
            <tr key={linha.campo}>
              <td className="px-4 py-3">{linha.label}</td>
              <td className="px-4 py-3 text-right">
                {formatarNumero(quantificacao[linha.campo] as number, 2)} {linha.unidade}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
