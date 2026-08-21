"use client";

import { useRouter } from "next/navigation";
import FormCliente from "@/components/FormCliente";
import { useWizardStore } from "@/lib/store";
import type { Cliente } from "@/lib/types";

export default function Step1ClientePage() {
  const router = useRouter();
  const { clienteSelecionado, setCliente } = useWizardStore();

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

      <div className="flex justify-end">
        <button
          type="button"
          className="btn-primary"
          disabled={!clienteSelecionado}
          onClick={() => router.push("/novo-orcamento/step-2-especificacoes")}
        >
          Próximo →
        </button>
      </div>
    </div>
  );
}
