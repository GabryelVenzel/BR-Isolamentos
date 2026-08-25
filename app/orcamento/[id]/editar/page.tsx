"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { formatarMoeda } from "@/lib/format";
import type { Orcamento, StatusOrcamento } from "@/lib/types";

const STATUS_OPCOES: StatusOrcamento[] = ["rascunho", "proposta", "enviado", "aceito", "rejeitado"];

export default function EditarOrcamentoPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [orcamento, setOrcamento] = useState<Orcamento | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/orcamentos/${id}`)
      .then((r) => r.json())
      .then(setOrcamento);
  }, [id]);

  if (!orcamento) return <p className="text-sm text-gray-500">Carregando...</p>;

  function atualizarCampo<K extends keyof Orcamento>(campo: K, valor: Orcamento[K]) {
    setOrcamento((prev) => (prev ? { ...prev, [campo]: valor } : prev));
  }

  function recalcularValorFinal(atual: Orcamento): Orcamento {
    const preco_cheio = Number((atual.subtotal + atual.total_impostos + atual.margem_lucro).toFixed(2));
    const valor_final = Number((preco_cheio - atual.valor_desconto).toFixed(2));
    return { ...atual, preco_cheio, valor_final };
  }

  async function salvar() {
    if (!orcamento) return;
    setErro(null);
    setSalvando(true);
    const atualizado = recalcularValorFinal(orcamento);

    try {
      const response = await fetch(`/api/orcamentos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(atualizado),
      });
      const data = await response.json();

      if (!response.ok) {
        setErro(data.error ?? "Erro ao salvar alterações.");
        return;
      }

      router.push(`/orcamento/${id}`);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold">Editar {orcamento.numero}</h1>
        <p className="text-sm text-gray-500">
          Ajuste o status, a margem de lucro ou o desconto aplicado. Para alterar especificações
          técnicas ou materiais, gere um novo orçamento (ou duplique este no Histórico).
        </p>
      </div>

      <div className="card space-y-4">
        <div>
          <label className="label-field">Status</label>
          <p className="mb-1 text-xs text-gray-400">
            Enquanto este orçamento estiver vinculado a um lead (Comercial), o status muda
            sozinho conforme a etapa do lead (Proposta/Negociação → Enviado, Fechado → Aceito,
            Perdido → Rejeitado). Só ajuste manualmente se este orçamento não estiver vinculado
            a nenhum lead.
          </p>
          <select
            className="input-field"
            value={orcamento.status}
            onChange={(e) => atualizarCampo("status", e.target.value as StatusOrcamento)}
          >
            {STATUS_OPCOES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label-field">Margem de lucro (R$)</label>
            <input
              type="number"
              step="0.01"
              className="input-field"
              value={orcamento.margem_lucro}
              onChange={(e) => atualizarCampo("margem_lucro", Number(e.target.value))}
            />
          </div>
          <div>
            <label className="label-field">Desconto (R$)</label>
            <input
              type="number"
              step="0.01"
              className="input-field"
              value={orcamento.valor_desconto}
              onChange={(e) => atualizarCampo("valor_desconto", Number(e.target.value))}
            />
          </div>
        </div>

        <p className="text-sm text-gray-500">
          Novo valor final: <span className="font-semibold text-gray-900">{formatarMoeda(recalcularValorFinal(orcamento).valor_final)}</span>
        </p>
      </div>

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <div className="flex justify-end gap-3">
        <button type="button" className="btn-secondary" onClick={() => router.push(`/orcamento/${id}`)}>
          Cancelar
        </button>
        <button type="button" className="btn-primary" onClick={salvar} disabled={salvando}>
          {salvando ? "Salvando..." : "Salvar alterações"}
        </button>
      </div>
    </div>
  );
}
