"use client";

import Link from "next/link";
import { formatarData, formatarMoeda, classesStatus, formatarStatus } from "@/lib/format";
import type { Orcamento } from "@/lib/types";

interface Props {
  orcamentos: Orcamento[];
  onExcluir?: (id: number) => void;
}

/** "Duplicar" removida (pedido explícito — ações confusas/desnecessárias
 * demais na tabela). "Editar" continua indo pra /orcamento/[id]/editar, que
 * agora mostra o orçamento completo (trechos) além dos campos de status/
 * margem/desconto — ver comentário no topo daquela página pro porquê de não
 * ter virado o wizard inteiro de novo. */
export default function TableOrcamentos({ orcamentos, onExcluir }: Props) {
  if (orcamentos.length === 0) {
    return (
      <div className="card text-center text-sm text-gray-500">
        Nenhum orçamento encontrado.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="table-header">
          <tr>
            <th className="px-4 py-3">Número</th>
            <th className="px-4 py-3">Cliente</th>
            <th className="px-4 py-3">Data</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Valor Final</th>
            <th className="px-4 py-3 text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {orcamentos.map((orcamento) => (
            <tr key={orcamento.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-medium text-brand">
                <Link href={`/orcamento/${orcamento.id}`}>{orcamento.numero}</Link>
              </td>
              <td className="px-4 py-3">{orcamento.cliente?.nome ?? "—"}</td>
              <td className="px-4 py-3">{formatarData(orcamento.data_criacao)}</td>
              <td className="px-4 py-3">
                <span className={`badge ${classesStatus(orcamento.status)}`}>
                  {formatarStatus(orcamento.status)}
                </span>
              </td>
              <td className="px-4 py-3 text-right font-medium">{formatarMoeda(orcamento.valor_final)}</td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-3 text-xs">
                  <Link href={`/orcamento/${orcamento.id}/editar`} className="text-brand hover:underline">
                    Editar
                  </Link>
                  <Link href={`/orcamento/${orcamento.id}/download-pdf`} className="text-gray-600 hover:underline">
                    PDF
                  </Link>
                  {onExcluir && (
                    <button
                      type="button"
                      onClick={() => onExcluir(orcamento.id)}
                      className="text-red-600 hover:underline"
                    >
                      Excluir
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
