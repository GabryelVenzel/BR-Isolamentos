"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ModalItemEscopo from "@/components/ModalItemEscopo";
import TabelaItensEscopo from "@/components/TabelaItensEscopo";
import { useWizardStore } from "@/lib/store";
import { somarMetragemEscopo } from "@/lib/usecases/orcamento";
import { formatarNumero } from "@/lib/format";
import type { ItemEscopo } from "@/lib/types";

/** Tela 2 (nova) — Escopo: lista de itens (áreas/tubos/curvas) do trecho
 * atual, com metragem calculada automaticamente. Passa a metragem total para
 * a tela de Especificações (pré-preenchida, editável lá com seu próprio
 * checkbox de override "no nível do trecho" — diferente do override por
 * item que existe aqui). */
export default function Step2EscopoPage() {
  const router = useRouter();
  const { clienteSelecionado, escopoAtual, setEscopoAtual, itens, itemAtual, setItemAtual } = useWizardStore();
  const [editando, setEditando] = useState<ItemEscopo | "novo" | null>(null);

  const total = somarMetragemEscopo(escopoAtual);

  function salvarItem(item: ItemEscopo) {
    const existe = escopoAtual.some((i) => i.id === item.id);
    setEscopoAtual(existe ? escopoAtual.map((i) => (i.id === item.id ? item : i)) : [...escopoAtual, item]);
    setEditando(null);
  }

  function removerItem(id: string) {
    setEscopoAtual(escopoAtual.filter((i) => i.id !== id));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">2. Escopo {itens.length > 0 && `— trecho ${itens.length + 1}`}</h1>
        <p className="text-sm text-gray-500">
          Defina os itens do projeto (áreas, tubos, curvas). A metragem total calculada aqui vira a
          base das especificações técnicas do próximo passo.
        </p>
      </div>

      {!clienteSelecionado && (
        <p className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-700">
          Selecione um cliente no passo anterior antes de continuar.
        </p>
      )}

      {itens.length > 0 && (
        <div className="rounded-lg bg-accent-light px-4 py-2 text-sm text-accent-dark">
          {itens.length} trecho(s) já adicionado(s) a este orçamento.
        </div>
      )}

      <div className="flex justify-end">
        <button type="button" className="btn-primary" onClick={() => setEditando("novo")}>
          + Adicionar Item
        </button>
      </div>

      <TabelaItensEscopo
        itens={escopoAtual}
        onEditar={(item) => setEditando(item)}
        onRemover={removerItem}
      />

      <div className="card flex items-center justify-between">
        <span className="font-montserrat text-sm font-bold uppercase text-brand">Total metragem</span>
        <span className="font-montserrat text-2xl font-bold text-accent">{formatarNumero(total, 2)} m²</span>
      </div>

      {/* Migração 019 — "tem curvas"/"tubulação pequena" já são deriváveis
          dos itens de escopo acima (tipo/diâmetro), não pedidos de novo
          aqui. Só "trabalho em altura" precisa de um campo próprio: não tem
          proxy no Escopo, e só afeta a eficiência da mão de obra (nunca a
          quantificação de material) — ver calcularMaoObraAutomatica.ts. */}
      <label className="card flex cursor-pointer items-center justify-between">
        <span>
          <span className="block text-sm font-medium text-gray-800">Trabalho em altura (&gt; 2m)?</span>
          <span className="block text-xs text-gray-400">Afeta só o cálculo de mão de obra deste trecho.</span>
        </span>
        <input
          type="checkbox"
          checked={itemAtual.trabalho_altura}
          onChange={(e) => setItemAtual({ trabalho_altura: e.target.checked })}
        />
      </label>

      {editando && (
        <ModalItemEscopo
          itemInicial={editando === "novo" ? null : editando}
          onFechar={() => setEditando(null)}
          onSalvar={salvarItem}
        />
      )}

      <div className="flex justify-between">
        <button type="button" className="btn-secondary" onClick={() => router.push("/novo-orcamento/step-1-cliente")}>
          ← Voltar
        </button>
        <button
          type="button"
          className="btn-primary"
          disabled={!clienteSelecionado || escopoAtual.length === 0}
          onClick={() => router.push("/novo-orcamento/step-3-especificacoes")}
        >
          Próximo →
        </button>
      </div>
    </div>
  );
}
