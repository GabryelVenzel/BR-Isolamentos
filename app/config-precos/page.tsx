"use client";

import { useEffect, useState } from "react";
import FormPrecos from "@/components/FormPrecos";
import FormConfigEmpresa from "@/components/FormConfigEmpresa";
import type { ConfigEmpresa, PrecoConfig } from "@/lib/types";

export default function ConfigPrecosPage() {
  const [precos, setPrecos] = useState<PrecoConfig[] | null>(null);
  const [config, setConfig] = useState<ConfigEmpresa | null>(null);

  useEffect(() => {
    fetch("/api/precos-config")
      .then((r) => r.json())
      .then(setPrecos);
    fetch("/api/config-empresa")
      .then((r) => r.json())
      .then(setConfig);
  }, []);

  async function salvarPrecos(itens: PrecoConfig[]) {
    const response = await fetch("/api/precos-config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(itens),
    });
    if (!response.ok) throw new Error("Falha ao salvar preços.");
    setPrecos(itens);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configuração de Preços</h1>
        <p className="text-sm text-gray-500">
          Defina os preços dos materiais e os parâmetros financeiros usados no cálculo de orçamentos.
        </p>
      </div>

      {precos ? <FormPrecos precos={precos} onSalvar={salvarPrecos} /> : <p className="text-sm text-gray-500">Carregando...</p>}
      {config ? <FormConfigEmpresa config={config} /> : <p className="text-sm text-gray-500">Carregando...</p>}
    </div>
  );
}
