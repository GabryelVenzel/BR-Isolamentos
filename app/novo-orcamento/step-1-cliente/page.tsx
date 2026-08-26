"use client";

import { useRouter } from "next/navigation";
import FormCliente from "@/components/FormCliente";
import { useWizardStore } from "@/lib/store";
import type { Cliente } from "@/lib/types";

export default function Step1ClientePage() {
  const router = useRouter();
  const { clienteSelecionado, setCliente, tipoProposta, setTipoProposta } = useWizardStore();

  function handleSelecionar(cliente: Cliente | null) {
    setCliente(cliente);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">1. Dados do cliente</h1>
        <p className="text-sm text-gray-500">Busque um cliente existente ou cadastre um novo.</p>
      </div>

      <FormCliente clienteSelecionado={clienteSelecionado} onSelecionar={handleSelecionar} />

      {/* Migração 019 — vale pro orçamento inteiro, não por trecho. "Somente
          Mão de Obra" esconde a quantificação/preço de material nas telas
          seguintes e zera esse custo no cálculo final. */}
      <div className="card space-y-3">
        <label className="label-field">Tipo de proposta</label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm ${
              tipoProposta === "material_mo" ? "border-brand bg-brand-light/40" : "border-gray-200"
            }`}
          >
            <input
              type="radio"
              className="mt-1"
              checked={tipoProposta === "material_mo"}
              onChange={() => setTipoProposta("material_mo")}
            />
            <span>
              <span className="block font-medium text-gray-800">Material + Mão de Obra</span>
              <span className="block text-xs text-gray-500">Quantificação completa de materiais e mão de obra.</span>
            </span>
          </label>
          <label
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm ${
              tipoProposta === "somente_mo" ? "border-brand bg-brand-light/40" : "border-gray-200"
            }`}
          >
            <input
              type="radio"
              className="mt-1"
              checked={tipoProposta === "somente_mo"}
              onChange={() => setTipoProposta("somente_mo")}
            />
            <span>
              <span className="block font-medium text-gray-800">Somente Mão de Obra</span>
              <span className="block text-xs text-gray-500">Apenas o cálculo de horas — sem custo de material.</span>
            </span>
          </label>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          className="btn-primary"
          disabled={!clienteSelecionado}
          onClick={() => router.push("/novo-orcamento/step-2-escopo")}
        >
          Próximo →
        </button>
      </div>
    </div>
  );
}
