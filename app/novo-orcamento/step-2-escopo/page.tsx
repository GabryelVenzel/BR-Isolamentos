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

      {/* Migração 019 — "tem curvas"/"tubulação pequena" já são deriváveis
          dos itens de escopo (tipo/diâmetro), não pedidos de novo aqui. Só
          "trabalho em altura" precisa de um campo próprio: não tem proxy no
          Escopo, e só afeta a eficiência da mão de obra (nunca a
          quantificação de material) — ver calcularMaoObraAutomatica.ts. Fica
          no topo, em destaque, porque muda bastante os dias de obra e era
          fácil de passar batido no rodapé. */}
      <div className="flex flex-wrap items-stretch justify-between gap-3">
        <label
          className={`flex flex-1 cursor-pointer items-center gap-3 rounded-card border px-4 py-3 ${
            itemAtual.trabalho_altura ? "border-amber-400 bg-amber-50" : "border-gray-200 bg-white"
          }`}
        >
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={itemAtual.trabalho_altura}
            onChange={(e) => setItemAtual({ trabalho_altura: e.target.checked })}
          />
          <span>
            <span className="block text-sm font-medium text-gray-800">Este trecho é trabalho em altura (acima de 2 m)</span>
            <span className="block text-xs text-gray-500">Reduz o rendimento da equipe neste trecho e aumenta os dias de obra. Não muda a quantidade de material.</span>
          </span>
        </label>
        {/* Remoção do isolamento existente (migração 051) — mesma lógica da
            altura: consome tempo de obra (fator em Configurações do orçamento) e, na
            proposta, passa de "Não contemplado" para "O orçamento contempla". */}
        <label
          className={`flex flex-1 cursor-pointer items-center gap-3 rounded-card border px-4 py-3 ${
            itemAtual.remocao_isolamento ? "border-amber-400 bg-amber-50" : "border-gray-200 bg-white"
          }`}
        >
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={!!itemAtual.remocao_isolamento}
            onChange={(e) => setItemAtual({ remocao_isolamento: e.target.checked })}
          />
          <span>
            <span className="block text-sm font-medium text-gray-800">Este trecho tem remoção do isolamento existente</span>
            <span className="block text-xs text-gray-500">Aumenta os dias de obra e aparece na proposta como serviço contemplado. Não muda a quantidade de material.</span>
          </span>
        </label>
        <button type="button" className="btn-primary self-center" onClick={() => setEditando("novo")}>
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
