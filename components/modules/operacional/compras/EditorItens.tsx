"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { CampoMoeda } from "@/components/ui/CamposDocumento";
import { UNIDADES_COMPRA, type ItemListaCompras } from "@/lib/compras";
import { formatarMoeda } from "@/lib/format";
import { toast } from "../toast";

/** Item em edição — quantidade e preço ficam em texto enquanto o usuário digita. */
export interface ItemEditavel {
  chave: string;
  descricao: string;
  unidade: string;
  quantidade: string;
  preco: string;
  preco_config_id: number | null;
}

export interface ItemDoCatalogo {
  id: number;
  descricao: string;
  preco_unitario: number;
  unidade: string | null;
  ativo: boolean;
}

export const novaChave = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random()));

export const itemVazio = (): ItemEditavel => ({ chave: novaChave(), descricao: "", unidade: "un", quantidade: "1", preco: "", preco_config_id: null });

interface Props {
  itens: ItemEditavel[];
  onChange: (itens: ItemEditavel[]) => void;
  /** Pedido de compra tem preço; cotação não (o preço vem de cada proposta). */
  comPreco: boolean;
  /** Obra selecionada — habilita "Puxar materiais do orçamento da obra". */
  servicoId: string;
  /** Catálogo de preços do orçamento, pra ligar o item comprado a ele (opcional). */
  catalogo?: ItemDoCatalogo[];
  somenteLeitura?: boolean;
}

/** Tabela de itens editável, usada no pedido de compra e na cotação. */
export default function EditorItens({ itens, onChange, comPreco, servicoId, catalogo, somenteLeitura = false }: Props) {
  const [multiplicador, setMultiplicador] = useState("1");
  const [puxando, setPuxando] = useState(false);

  const alterar = (chave: string, patch: Partial<ItemEditavel>) => onChange(itens.map((i) => (i.chave === chave ? { ...i, ...patch } : i)));

  async function puxarDaObra() {
    const fator = Number(multiplicador.replace(",", "."));
    if (!Number.isFinite(fator) || fator <= 0) {
      toast.erro("Informe um multiplicador maior que zero.");
      return;
    }
    setPuxando(true);
    try {
      const response = await fetch(`/api/operacional/compras/lista-obra?servico_id=${servicoId}&multiplicador=${fator}`);
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        toast.erro(payload.error ?? "Não foi possível montar a lista da obra.");
        return;
      }
      const lista: ItemListaCompras[] = payload.data;
      if (lista.length === 0) {
        toast.aviso("O orçamento desta obra não tem materiais quantificados.");
        return;
      }
      const novos = lista.map((l) => ({ ...itemVazio(), descricao: l.descricao, unidade: l.unidade, quantidade: String(l.quantidade) }));
      // Substitui a linha em branco inicial; se já há itens preenchidos, acrescenta.
      const preenchidos = itens.filter((i) => i.descricao.trim());
      onChange([...preenchidos, ...novos]);
      toast.sucesso(`${novos.length} materiais do orçamento adicionados. Confira as quantidades.`);
    } catch {
      toast.erro("Erro de conexão ao montar a lista da obra.");
    } finally {
      setPuxando(false);
    }
  }

  const total = itens.reduce((soma, i) => soma + (Number(i.quantidade) || 0) * (Number(i.preco) || 0), 0);

  return (
    <div className="space-y-3">
      {!somenteLeitura && servicoId && (
        <div className="flex flex-wrap items-end gap-2 rounded-input bg-brand-light/60 px-3 py-2 text-xs text-gray-700">
          <span className="flex-1 basis-56">
            Puxar os materiais quantificados no orçamento desta obra. Use o multiplicador quando o orçamento foi feito por metro ou por unidade (ex.: 100).
          </span>
          <label className="flex items-center gap-1">
            ×
            <input
              aria-label="Multiplicador das quantidades"
              className="input-field w-20 py-1 text-xs"
              inputMode="decimal"
              value={multiplicador}
              onChange={(e) => setMultiplicador(e.target.value)}
            />
          </label>
          <button type="button" className="btn-secondary px-3 py-1 text-xs" onClick={puxarDaObra} disabled={puxando}>
            {puxando ? "Buscando..." : "Puxar do orçamento"}
          </button>
        </div>
      )}

      <div className="space-y-2">
        {itens.map((item, indice) => (
          <div key={item.chave} className="rounded-input border border-gray-200 p-2">
            <div className="grid grid-cols-12 gap-2">
              <input
                aria-label={`Descrição do item ${indice + 1}`}
                className={`input-field col-span-12 py-1.5 ${comPreco ? "sm:col-span-5" : "sm:col-span-7"}`}
                placeholder="Descrição do item"
                value={item.descricao}
                disabled={somenteLeitura}
                onChange={(e) => alterar(item.chave, { descricao: e.target.value })}
              />
              <input
                aria-label={`Quantidade do item ${indice + 1}`}
                className="input-field col-span-4 py-1.5 text-right sm:col-span-2"
                inputMode="decimal"
                placeholder="Qtd."
                value={item.quantidade}
                disabled={somenteLeitura}
                onChange={(e) => alterar(item.chave, { quantidade: e.target.value.replace(",", ".") })}
              />
              <select
                aria-label={`Unidade do item ${indice + 1}`}
                className="input-field col-span-4 py-1.5 sm:col-span-2"
                value={item.unidade}
                disabled={somenteLeitura}
                onChange={(e) => alterar(item.chave, { unidade: e.target.value })}
              >
                {[...new Set([...UNIDADES_COMPRA, item.unidade])].map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
              {comPreco && (
                <div className="col-span-4 sm:col-span-2">
                  <CampoMoeda value={item.preco} onChange={(v) => alterar(item.chave, { preco: v })} disabled={somenteLeitura} />
                </div>
              )}
              {!somenteLeitura && (
                <button
                  type="button"
                  className="col-span-12 justify-self-end p-1 text-status-error hover:opacity-70 sm:col-span-1 sm:justify-self-center"
                  title="Remover item"
                  aria-label={`Remover item ${indice + 1}`}
                  onClick={() => onChange(itens.length > 1 ? itens.filter((i) => i.chave !== item.chave) : [itemVazio()])}
                >
                  <Trash2 className="icone" aria-hidden />
                </button>
              )}
            </div>
            {comPreco && (
              <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                {catalogo && catalogo.length > 0 ? (
                  <select
                    aria-label={`Item do catálogo de preços ligado ao item ${indice + 1}`}
                    className="max-w-full rounded-input border border-gray-200 bg-white px-2 py-0.5 text-xs"
                    value={item.preco_config_id ?? ""}
                    disabled={somenteLeitura}
                    onChange={(e) => alterar(item.chave, { preco_config_id: e.target.value ? Number(e.target.value) : null })}
                  >
                    <option value="">Sem ligação com o catálogo do orçamento</option>
                    {catalogo.map((c) => (
                      <option key={c.id} value={c.id}>
                        Catálogo: {c.descricao} ({formatarMoeda(Number(c.preco_unitario))}
                        {c.unidade ? `/${c.unidade}` : ""})
                      </option>
                    ))}
                  </select>
                ) : (
                  <span />
                )}
                <span>Subtotal: {formatarMoeda((Number(item.quantidade) || 0) * (Number(item.preco) || 0))}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {!somenteLeitura ? (
          <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={() => onChange([...itens, itemVazio()])}>
            <Plus className="icone mr-1" aria-hidden /> Adicionar item
          </button>
        ) : (
          <span />
        )}
        {comPreco && (
          <p className="font-montserrat text-sm font-bold text-brand">
            Total: {formatarMoeda(total)}
          </p>
        )}
      </div>
    </div>
  );
}
