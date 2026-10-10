"use client";

import { descreverItemEscopo, metragemFinalItem } from "@/lib/usecases/orcamento";
import { formatarNumero } from "@/lib/format";
import type { ItemEscopo } from "@/lib/types";
import { Pencil, Trash2 } from "lucide-react";

interface Props {
  itens: ItemEscopo[];
  onEditar: (item: ItemEscopo) => void;
  onRemover: (id: string) => void;
}

const LABEL_TIPO: Record<ItemEscopo["tipo"], string> = { tubulacao: "Tubulação", curva: "Curva", plano: "Plano" };

export default function TabelaItensEscopo({ itens, onEditar, onRemover }: Props) {
  if (itens.length === 0) {
    return <p className="text-sm text-gray-400">Nenhum item adicionado ainda.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-card border border-gray-200">
      <table className="tabela-cartoes w-full text-sm">
        <thead className="table-header">
          <tr>
            <th className="px-3 py-2 text-left">Nome</th>
            <th className="px-3 py-2 text-left">Tipo</th>
            <th className="px-3 py-2 text-left">Especificação</th>
            <th className="px-3 py-2 text-right">Metragem</th>
            <th className="px-3 py-2 text-left">Cálculo</th>
            <th className="px-3 py-2 text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {itens.map((item) => (
            <tr key={item.id}>
              <td data-label="Nome" className="px-3 py-2 font-medium">{item.nome}</td>
              <td data-label="Tipo" className="px-3 py-2">{LABEL_TIPO[item.tipo]}</td>
              <td data-label="Especificação" className="px-3 py-2 text-gray-500">{descreverItemEscopo(item)}</td>
              <td data-label="Metragem" className="px-3 py-2 text-right font-montserrat font-semibold text-brand">
                {formatarNumero(metragemFinalItem(item), 2)} m²
              </td>
              <td data-label="Cálculo" className="px-3 py-2 text-xs text-gray-500">
                {item.tipo === "plano" ? "Manual (entrada)" : item.metragem_editada ? "Manual (override)" : "Automático"}
              </td>
              <td data-label="Ações" className="px-3 py-2 text-right">
                <button type="button" className="mr-2 hover:opacity-70" title="Editar" aria-label="Editar" onClick={() => onEditar(item)}>
                  <Pencil className="icone" aria-hidden />
                </button>
                <button type="button" className="hover:opacity-70" title="Remover" aria-label="Remover" onClick={() => onRemover(item.id)}>
                  <Trash2 className="icone" aria-hidden />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
