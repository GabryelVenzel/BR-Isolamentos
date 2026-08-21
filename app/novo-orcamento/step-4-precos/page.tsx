"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWizardStore } from "@/lib/store";
import { formatarMoeda } from "@/lib/format";
import type { CalcularOrcamentoInput, ConfigEmpresa, PrecoConfig } from "@/lib/types";

export default function Step4PrecosPage() {
  const router = useRouter();
  const { quantificacao, custosOperacionais, setCustosOperacionais, resultadoOrcamento, setResultadoOrcamento } =
    useWizardStore();

  const [precos, setPrecos] = useState<PrecoConfig[]>([]);
  const [config, setConfig] = useState<ConfigEmpresa | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/precos-config").then((r) => r.json()).then(setPrecos);
    fetch("/api/config-empresa").then((r) => r.json()).then(setConfig);
  }, []);

  async function calcular() {
    if (!quantificacao || !config) return;
    setErro(null);
    setCalculando(true);

    try {
      const payload: CalcularOrcamentoInput = {
        quantificacao,
        precos,
        config,
        horas_mao_obra: custosOperacionais.horas_mao_obra,
        km_deslocamento: custosOperacionais.km_deslocamento,
        noites_hospedagem: custosOperacionais.noites_hospedagem,
        toneladas_frete: custosOperacionais.toneladas_frete,
        desconto_percentual_extra: custosOperacionais.desconto_percentual_extra ?? undefined,
      };

      const response = await fetch("/api/calcular-orcamento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        setErro(data.error ?? "Erro ao calcular orçamento.");
        return;
      }

      setResultadoOrcamento(data);
    } finally {
      setCalculando(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">4. Custos operacionais e preços</h1>
        <p className="text-sm text-gray-500">
          Os preços de materiais e parâmetros financeiros vêm da tela de{" "}
          <a href="/config-precos" className="text-brand hover:underline">
            Configuração de Preços
          </a>
          .
        </p>
      </div>

      <div className="card grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="label-field">Mão de obra (horas)</label>
          <input
            type="number"
            className="input-field"
            value={custosOperacionais.horas_mao_obra}
            onChange={(e) => setCustosOperacionais({ horas_mao_obra: Number(e.target.value) })}
          />
        </div>
        <div>
          <label className="label-field">Deslocamento (km)</label>
          <input
            type="number"
            className="input-field"
            value={custosOperacionais.km_deslocamento}
            onChange={(e) => setCustosOperacionais({ km_deslocamento: Number(e.target.value) })}
          />
        </div>
        <div>
          <label className="label-field">Hospedagem (noites)</label>
          <input
            type="number"
            className="input-field"
            value={custosOperacionais.noites_hospedagem}
            onChange={(e) => setCustosOperacionais({ noites_hospedagem: Number(e.target.value) })}
          />
        </div>
        <div>
          <label className="label-field">Frete (toneladas)</label>
          <input
            type="number"
            step="0.01"
            className="input-field"
            value={custosOperacionais.toneladas_frete}
            onChange={(e) => setCustosOperacionais({ toneladas_frete: Number(e.target.value) })}
          />
        </div>
        <div>
          <label className="label-field">Desconto competitivo extra (%, opcional)</label>
          <input
            type="number"
            step="0.1"
            className="input-field"
            placeholder="usar padrão da empresa"
            value={custosOperacionais.desconto_percentual_extra ?? ""}
            onChange={(e) => setCustosOperacionais({ desconto_percentual_extra: Number(e.target.value) })}
          />
        </div>
      </div>

      <div className="card">
        <button type="button" className="btn-primary" onClick={calcular} disabled={calculando || !quantificacao}>
          {calculando ? "Calculando..." : "Calcular orçamento"}
        </button>
        {erro && <p className="mt-3 text-sm text-red-600">{erro}</p>}
      </div>

      {resultadoOrcamento && (
        <div className="card space-y-2 text-sm">
          <h2 className="mb-2 text-lg font-semibold">Resumo financeiro</h2>
          <Linha label="Valor materiais" valor={resultadoOrcamento.valor_materiais} />
          <Linha label="Mão de obra" valor={resultadoOrcamento.valor_mao_obra} />
          <Linha label="Deslocamento" valor={resultadoOrcamento.valor_deslocamento} />
          <Linha label="Hospedagem" valor={resultadoOrcamento.valor_hospedagem} />
          <Linha label="Frete" valor={resultadoOrcamento.valor_frete} />
          <Linha label="Subtotal" valor={resultadoOrcamento.subtotal} destaque />
          <Linha label="ISS" valor={resultadoOrcamento.valor_iss} />
          <Linha label="INSS" valor={resultadoOrcamento.valor_inss} />
          <Linha label="Margem de lucro" valor={resultadoOrcamento.margem_lucro} />
          <Linha label="Desconto" valor={-resultadoOrcamento.valor_desconto} />
          <Linha label="Valor final" valor={resultadoOrcamento.valor_final} destaque />
        </div>
      )}

      <div className="flex justify-between">
        <button type="button" className="btn-secondary" onClick={() => router.push("/novo-orcamento/step-3-calculos")}>
          ← Voltar
        </button>
        <button
          type="button"
          className="btn-primary"
          disabled={!resultadoOrcamento}
          onClick={() => router.push("/novo-orcamento/step-5-revisao")}
        >
          Próximo →
        </button>
      </div>
    </div>
  );
}

function Linha({ label, valor, destaque }: { label: string; valor: number; destaque?: boolean }) {
  return (
    <div className={`flex justify-between ${destaque ? "border-t border-gray-200 pt-2 font-semibold" : ""}`}>
      <span>{label}</span>
      <span>{formatarMoeda(valor)}</span>
    </div>
  );
}
