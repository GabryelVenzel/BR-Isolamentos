"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { formatarMoeda, formatarNumero } from "@/lib/format";
import type { Orcamento, StatusOrcamento } from "@/lib/types";

const STATUS_OPCOES: StatusOrcamento[] = ["rascunho", "proposta", "enviado", "aceito", "rejeitado"];

const LABEL_TIPO_TRABALHO: Record<string, string> = { quente: "Quente", frio: "Frio", misto: "Misto" };

/** Editar Orçamento (refinada — pedido explícito: "o popup de margem não
 * deixa ver o orçamento completo"). Mostra os trechos do orçamento (lidos
 * via join `itens_orcamento`, já disponível em GET /api/orcamentos/[id]) pra
 * dar contexto — mas continua editando só os campos financeiros do
 * ORÇAMENTO (status/margem/desconto), não os trechos em si.
 *
 * NÃO reconstrói o wizard de 5 telas pra reeditar escopo/materiais de um
 * trecho existente: os dados salvos em `itens_orcamento` não cobrem todos os
 * campos que o wizard usa durante a criação (ex.: combustível/horas de
 * operação usados só no cálculo de economia, nunca persistidos) — recarregar
 * isso de volta no wizard recalcularia números que já foram cobrados/
 * propostos ao cliente de um jeito que pode não bater com o que foi salvo.
 * Pra mudar material/escopo de um trecho, o caminho é criar um novo
 * orçamento — o que já existe. */
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

      // Volta pro Histórico de Orçamentos (de onde "Editar" é acionado — ver
      // components/TableOrcamentos.tsx), não pra tela de resumo/detalhe do
      // orçamento (bug reportado: usuário editava e caía num lugar que não
      // era de onde tinha vindo).
      router.push("/historico");
    } finally {
      setSalvando(false);
    }
  }

  const itensOrdenados = [...(orcamento.itens ?? [])].sort((a, b) => a.ordem - b.ordem);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-bold">Editar {orcamento.numero}</h1>
        <p className="text-sm text-gray-500">
          Confira os trechos deste orçamento abaixo e ajuste status, margem de lucro ou desconto. Para alterar
          especificações técnicas ou materiais de um trecho, gere um novo orçamento.
        </p>
      </div>

      {itensOrdenados.length > 0 && (
        <div className="card space-y-3">
          <h2 className="text-lg font-semibold">Trechos deste orçamento ({itensOrdenados.length})</h2>
          <div className="space-y-2">
            {itensOrdenados.map((item, index) => (
              <div key={item.id} className="rounded-lg border border-gray-200 p-3 text-sm">
                <p className="font-medium text-gray-800">
                  Trecho {index + 1} — {LABEL_TIPO_TRABALHO[item.tipo_trabalho] ?? item.tipo_trabalho}
                </p>
                <div className="mt-1 grid grid-cols-1 gap-1 text-gray-500 sm:grid-cols-2">
                  <p>Material: {item.material}</p>
                  {item.acabamento && <p>Acabamento: {item.acabamento}</p>}
                  <p>Metragem: {formatarNumero(item.area_m2, 2)} m²</p>
                  <p>Mão de obra: {formatarNumero(item.horas_mao_obra, 1)}h</p>
                </div>
                <div className="mt-2 flex justify-between border-t border-gray-100 pt-1.5 text-xs text-gray-500">
                  <span>Material: {formatarMoeda(item.subtotal_material)}</span>
                  <span>Mão de obra: {formatarMoeda(item.subtotal_mao_obra)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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

      <div className="card space-y-2">
        <label className="label-field">Observações adicionais</label>
        <p className="text-xs text-gray-400">Aparece numa seção própria da Proposta Comercial, quando preenchida.</p>
        <textarea
          className="input-field h-24"
          value={orcamento.observacoes_adicionais ?? ""}
          onChange={(e) => atualizarCampo("observacoes_adicionais", e.target.value || null)}
          placeholder="Ex.: Cliente optou por isolante com melhor custo-benefício..."
        />
      </div>

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <div className="flex justify-end gap-3">
        <button type="button" className="btn-secondary" onClick={() => router.push("/historico")}>
          Cancelar
        </button>
        <button type="button" className="btn-primary" onClick={salvar} disabled={salvando}>
          {salvando ? "Salvando..." : "Salvar alterações"}
        </button>
      </div>
    </div>
  );
}
