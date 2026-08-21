"use client";

import { useRouter } from "next/navigation";
import FormEspecificacoes from "@/components/FormEspecificacoes";
import { useWizardStore } from "@/lib/store";

export default function Step2EspecificacoesPage() {
  const router = useRouter();
  const { clienteSelecionado, itemAtual: especificacoes, itens } = useWizardStore();

  const valido =
    especificacoes.material_id !== null &&
    especificacoes.area_m2 > 0 &&
    especificacoes.espessuras_mm.every((e) => e > 0) &&
    (especificacoes.geometria === "plana" || !!especificacoes.diametro_mm);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">2. Especificações técnicas {itens.length > 0 && `— trecho ${itens.length + 1}`}</h1>
        <p className="text-sm text-gray-500">
          Material, temperaturas, geometria e camadas de isolante deste trecho.
          {itens.length > 0 &&
            " Um orçamento pode ter vários trechos (ex.: quente + frio no mesmo projeto = orçamento misto)."}
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

      <FormEspecificacoes />

      <div className="flex justify-between">
        <button type="button" className="btn-secondary" onClick={() => router.push("/novo-orcamento/step-1-cliente")}>
          ← Voltar
        </button>
        <button
          type="button"
          className="btn-primary"
          disabled={!valido || !clienteSelecionado}
          onClick={() => router.push("/novo-orcamento/step-3-calculos")}
        >
          Próximo →
        </button>
      </div>
    </div>
  );
}
