"use client";

import { useState, type FormEvent } from "react";
import type { ConfigEmpresa } from "@/lib/types";

interface Props {
  config: ConfigEmpresa;
}

const CAMPOS: Array<{ nome: keyof ConfigEmpresa; label: string; grupo: string; sufixo?: string }> = [
  { nome: "valor_hora_mao_obra", label: "Mão de obra", grupo: "Custos operacionais", sufixo: "R$/hora" },
  { nome: "valor_km_deslocamento", label: "Deslocamento", grupo: "Custos operacionais", sufixo: "R$/km" },
  { nome: "valor_noite_hospedagem", label: "Hospedagem", grupo: "Custos operacionais", sufixo: "R$/noite" },
  { nome: "valor_frete_por_tonelada", label: "Frete", grupo: "Custos operacionais", sufixo: "R$/tonelada" },
  { nome: "aliquota_iss_percentual", label: "Alíquota ISS", grupo: "Impostos e margem", sufixo: "%" },
  { nome: "aliquota_inss_percentual", label: "Alíquota INSS", grupo: "Impostos e margem", sufixo: "%" },
  { nome: "margem_lucro_padrao", label: "Margem de lucro padrão", grupo: "Impostos e margem", sufixo: "%" },
  { nome: "desconto_competitivo", label: "Desconto competitivo padrão", grupo: "Impostos e margem", sufixo: "%" },
  {
    nome: "vedacit_gramas_por_junta",
    label: "Vedacit por junta (estimativa a validar)",
    grupo: "Quantificação",
    sufixo: "g",
  },
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

  const grupos = Array.from(new Set(CAMPOS.map((c) => c.grupo)));

  return (
    <form onSubmit={handleSubmit} className="card space-y-6">
      <h2 className="text-lg font-semibold">Custos, impostos e margem</h2>

      {grupos.map((grupo) => (
        <div key={grupo}>
          <h3 className="mb-2 text-sm font-semibold text-gray-600">{grupo}</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {CAMPOS.filter((c) => c.grupo === grupo).map((campo) => (
              <div key={campo.nome}>
                <label className="label-field">
                  {campo.label} {campo.sufixo && <span className="text-gray-400">({campo.sufixo})</span>}
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="input-field"
                  value={valores[campo.nome] as number}
                  onChange={(e) =>
                    setValores((prev) => ({ ...prev, [campo.nome]: Number(e.target.value) }))
                  }
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="flex items-center gap-3">
        <button type="submit" className="btn-primary" disabled={salvando}>
          {salvando ? "Salvando..." : "Salvar configuração"}
        </button>
        {mensagem && <span className="text-sm text-gray-500">{mensagem}</span>}
      </div>
    </form>
  );
}
