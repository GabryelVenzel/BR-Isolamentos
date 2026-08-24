"use client";

import { useEffect, useState } from "react";
import { calcularMetragemItem } from "@/lib/usecases/orcamento";
import { formatarNumero } from "@/lib/format";
import type { ItemEscopo, TipoItemEscopo } from "@/lib/types";

interface Props {
  itemInicial: ItemEscopo | null;
  onFechar: () => void;
  onSalvar: (item: ItemEscopo) => void;
}

const ITEM_VAZIO: ItemEscopo = {
  id: "",
  nome: "",
  tipo: "tubulacao",
  diametro_mm: null,
  comprimento_m: null,
  quantidade: null,
  metragem_manual_m2: null,
  metragem_editada: false,
};

/** Modal "Novo Item" do Escopo (Tela 2) — tubulação/curva/plano, com
 * metragem calculada automaticamente (ver lib/usecases/orcamento/escopo.ts)
 * e checkbox pra sobrescrever manualmente. */
export default function ModalItemEscopo({ itemInicial, onFechar, onSalvar }: Props) {
  const [item, setItem] = useState<ItemEscopo>(itemInicial ?? { ...ITEM_VAZIO, id: crypto.randomUUID() });

  useEffect(() => {
    setItem(itemInicial ?? { ...ITEM_VAZIO, id: crypto.randomUUID() });
  }, [itemInicial]);

  function atualizar(dados: Partial<ItemEscopo>) {
    setItem((prev) => ({ ...prev, ...dados }));
  }

  const metragemCalculada = item.tipo === "plano" ? null : calcularMetragemItem(item);

  const valido =
    item.nome.trim().length > 0 &&
    (item.tipo === "plano"
      ? item.metragem_manual_m2 !== null && item.metragem_manual_m2 > 0
      : item.tipo === "tubulacao"
        ? !!item.diametro_mm && !!item.comprimento_m
        : !!item.diametro_mm && !!item.quantidade) &&
    (!item.metragem_editada || (item.metragem_manual_m2 !== null && item.metragem_manual_m2 > 0));

  function salvar() {
    if (!valido) return;
    onSalvar(item);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg space-y-4 rounded-card bg-white p-6 shadow-xl">
        <h2 className="font-montserrat text-lg font-bold text-brand">{itemInicial ? "Editar Item" : "Novo Item"}</h2>

        <div>
          <label className="label-field">Nome do item*</label>
          <input
            className="input-field"
            placeholder='Ex.: "Tubo principal", "Área plana teto"'
            value={item.nome}
            onChange={(e) => atualizar({ nome: e.target.value })}
          />
        </div>

        <div>
          <label className="label-field">Tipo*</label>
          <div className="flex gap-4">
            {(
              [
                { valor: "tubulacao", label: "Tubulação" },
                { valor: "curva", label: "Curva" },
                { valor: "plano", label: "Plano" },
              ] as Array<{ valor: TipoItemEscopo; label: string }>
            ).map((opcao) => (
              <label key={opcao.valor} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={item.tipo === opcao.valor}
                  onChange={() => atualizar({ tipo: opcao.valor, diametro_mm: null, comprimento_m: null, quantidade: null })}
                />
                {opcao.label}
              </label>
            ))}
          </div>
        </div>

        {item.tipo === "tubulacao" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field">Diâmetro (mm)*</label>
              <input
                type="number"
                className="input-field"
                value={item.diametro_mm ?? ""}
                onChange={(e) => atualizar({ diametro_mm: e.target.value ? Number(e.target.value) : null })}
              />
            </div>
            <div>
              <label className="label-field">Comprimento linear (m)*</label>
              <input
                type="number"
                step="0.01"
                className="input-field"
                value={item.comprimento_m ?? ""}
                onChange={(e) => atualizar({ comprimento_m: e.target.value ? Number(e.target.value) : null })}
              />
            </div>
          </div>
        )}

        {item.tipo === "curva" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field">Diâmetro (mm)*</label>
              <input
                type="number"
                className="input-field"
                value={item.diametro_mm ?? ""}
                onChange={(e) => atualizar({ diametro_mm: e.target.value ? Number(e.target.value) : null })}
              />
            </div>
            <div>
              <label className="label-field">Quantidade*</label>
              <input
                type="number"
                className="input-field"
                value={item.quantidade ?? ""}
                onChange={(e) => atualizar({ quantidade: e.target.value ? Number(e.target.value) : null })}
              />
            </div>
          </div>
        )}

        {item.tipo === "plano" && (
          <div>
            <label className="label-field">Metragem quadrada (m²)*</label>
            <input
              type="number"
              step="0.01"
              className="input-field"
              value={item.metragem_manual_m2 ?? ""}
              onChange={(e) => atualizar({ metragem_manual_m2: e.target.value ? Number(e.target.value) : null })}
            />
          </div>
        )}

        {metragemCalculada !== null && (
          <p className="text-sm text-gray-600">
            → Metragem calculada: <strong>{formatarNumero(metragemCalculada, 2)} m²</strong> (auto)
          </p>
        )}

        {item.tipo !== "plano" && (
          <div className="space-y-2 rounded-lg bg-gray-50 p-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={item.metragem_editada}
                onChange={(e) => atualizar({ metragem_editada: e.target.checked })}
              />
              Editar metragem manualmente
            </label>
            {item.metragem_editada && (
              <input
                type="number"
                step="0.01"
                className="input-field"
                placeholder="Metragem final (m²)"
                value={item.metragem_manual_m2 ?? ""}
                onChange={(e) => atualizar({ metragem_manual_m2: e.target.value ? Number(e.target.value) : null })}
              />
            )}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={onFechar}>
            Cancelar
          </button>
          <button type="button" className="btn-primary" disabled={!valido} onClick={salvar}>
            {itemInicial ? "Salvar" : "Adicionar"}
          </button>
        </div>
      </div>
    </div>
  );
}
