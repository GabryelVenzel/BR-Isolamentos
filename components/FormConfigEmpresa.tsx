"use client";

import { useState, type FormEvent } from "react";
import type { AnexoSimplesNacional, ConfigEmpresa, RegimeTributario } from "@/lib/types";

interface Props {
  config: ConfigEmpresa;
}

const CAMPOS_CUSTOS: Array<{ nome: keyof ConfigEmpresa; label: string; sufixo: string }> = [
  { nome: "valor_hora_mao_obra", label: "Mão de obra", sufixo: "R$/hora" },
  { nome: "valor_km_deslocamento", label: "Deslocamento", sufixo: "R$/km" },
  { nome: "valor_noite_hospedagem", label: "Hospedagem", sufixo: "R$/noite" },
  { nome: "valor_frete_por_tonelada", label: "Frete", sufixo: "R$/tonelada" },
];

// "Desconto competitivo padrão" e "Vedacit por junta" removidos deste
// formulário (pedido explícito) — ver ConfigEmpresa.desconto_competitivo/
// vedacit_gramas_por_junta (@deprecated, lib/types.ts) pra o porquê de cada
// um. As colunas continuam no banco, só não são mais editáveis aqui.
const CAMPOS_MARGEM: Array<{ nome: keyof ConfigEmpresa; label: string; sufixo: string }> = [
  { nome: "margem_lucro_padrao", label: "Margem de lucro padrão", sufixo: "% do preço de venda" },
];

export default function FormConfigEmpresa({ config }: Props) {
  const [valores, setValores] = useState<ConfigEmpresa>(config);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSalvando(true);
    setMensagem(null);
    try {
      const response = await fetch("/api/config-empresa", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(valores),
      });
      setMensagem(response.ok ? "Configuração salva com sucesso." : "Erro ao salvar configuração.");
    } finally {
      setSalvando(false);
    }
  }

  function numero(nome: keyof ConfigEmpresa) {
    return (
      <input
        type="number"
        step="0.01"
        className="input-field"
        value={valores[nome] as number}
        onChange={(e) => setValores((prev) => ({ ...prev, [nome]: Number(e.target.value) }))}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-6">
      <h2 className="text-lg font-semibold">Custos, impostos e margem</h2>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-gray-600">Regime tributário</h3>
        <p className="mb-3 text-xs text-gray-500">
          Define como o percentual de impostos "base" é calculado. Impostos extras
          (opcionais, variam por contrato) ficam na tabela de Impostos abaixo.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="label-field">Regime</label>
            <select
              className="input-field"
              value={valores.regime_tributario}
              onChange={(e) =>
                setValores((prev) => ({ ...prev, regime_tributario: e.target.value as RegimeTributario }))
              }
            >
              <option value="simples_nacional">Simples Nacional</option>
              <option value="lucro_presumido">Lucro Presumido</option>
              <option value="personalizado">Personalizado (só impostos da lista)</option>
            </select>
          </div>

          {valores.regime_tributario === "simples_nacional" && (
            <>
              <div>
                <label className="label-field">
                  Anexo <span className="text-gray-400">(confirme com o contador)</span>
                </label>
                <select
                  className="input-field"
                  value={valores.simples_nacional_anexo}
                  onChange={(e) =>
                    setValores((prev) => ({
                      ...prev,
                      simples_nacional_anexo: e.target.value as AnexoSimplesNacional,
                    }))
                  }
                >
                  <option value="III">Anexo III</option>
                  <option value="IV">Anexo IV</option>
                </select>
              </div>
              <div>
                <label className="label-field">RBT12 (receita bruta 12 meses)</label>
                <input
                  type="number"
                  step="0.01"
                  className="input-field"
                  value={valores.simples_nacional_rbt12}
                  onChange={(e) =>
                    setValores((prev) => ({ ...prev, simples_nacional_rbt12: Number(e.target.value) }))
                  }
                />
              </div>
            </>
          )}
        </div>
        {valores.regime_tributario === "simples_nacional" && !valores.simples_nacional_rbt12 && (
          <p className="mt-2 text-sm text-amber-600">
            ⚠️ Sem o RBT12 preenchido, o sistema vai bloquear o cálculo de novos orçamentos.
          </p>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-gray-600">Custos operacionais</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CAMPOS_CUSTOS.map((campo) => (
            <div key={campo.nome}>
              <label className="label-field">
                {campo.label} <span className="text-gray-400">({campo.sufixo})</span>
              </label>
              {numero(campo.nome)}
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-gray-600">Margem</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CAMPOS_MARGEM.map((campo) => (
            <div key={campo.nome}>
              <label className="label-field">
                {campo.label} <span className="text-gray-400">({campo.sufixo})</span>
              </label>
              {numero(campo.nome)}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" className="btn-primary" disabled={salvando}>
          {salvando ? "Salvando..." : "Salvar configuração"}
        </button>
        {mensagem && <span className="text-sm text-gray-500">{mensagem}</span>}
      </div>
    </form>
  );
}
