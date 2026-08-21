"use client";

import { useEffect, useState } from "react";
import { useWizardStore } from "@/lib/store";
import type { Acabamento, CombustivelTipo, MaterialIsolante } from "@/lib/types";

const COMBUSTIVEIS: Array<{ value: CombustivelTipo; label: string }> = [
  { value: "eletricidade", label: "Eletricidade (kWh)" },
  { value: "oleo_bpf", label: "Óleo BPF (kg)" },
  { value: "gas_natural", label: "Gás Natural (m³)" },
  { value: "lenha_eucalipto", label: "Lenha Eucalipto 30% umidade (ton)" },
];

export default function FormEspecificacoes() {
  const { especificacoes, setEspecificacoes } = useWizardStore();
  const [materiais, setMateriais] = useState<MaterialIsolante[]>([]);
  const [acabamentos, setAcabamentos] = useState<Acabamento[]>([]);

  useEffect(() => {
    fetch("/api/materiais").then((r) => r.json()).then(setMateriais);
    fetch("/api/acabamentos").then((r) => r.json()).then(setAcabamentos);
  }, []);

  const isQuente = especificacoes.tipo_trabalho === "quente";
  const isTubulacao = especificacoes.geometria === "tubulacao";

  function atualizarEspessura(index: number, valor: number) {
    const espessuras = [...especificacoes.espessuras_mm];
    espessuras[index] = valor;
    setEspecificacoes({ espessuras_mm: espessuras });
  }

  function adicionarCamada() {
    setEspecificacoes({ espessuras_mm: [...especificacoes.espessuras_mm, 25] });
  }

  function removerCamada(index: number) {
    if (especificacoes.espessuras_mm.length <= 1) return;
    setEspecificacoes({ espessuras_mm: especificacoes.espessuras_mm.filter((_, i) => i !== index) });
  }

  return (
    <div className="space-y-6">
      <div className="card space-y-4">
        <div>
          <label className="label-field">Tipo de trabalho</label>
          <div className="flex gap-4">
            {(["quente", "frio"] as const).map((tipo) => (
              <label key={tipo} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={especificacoes.tipo_trabalho === tipo}
                  onChange={() => setEspecificacoes({ tipo_trabalho: tipo })}
                />
                {tipo === "quente" ? "🔥 Quente" : "🧊 Frio (condensação)"}
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="label-field">Material isolante</label>
            <select
              className="input-field"
              value={especificacoes.material_id ?? ""}
              onChange={(e) => setEspecificacoes({ material_id: Number(e.target.value) })}
            >
              <option value="" disabled>
                Selecione...
              </option>
              {materiais.map((material) => (
                <option key={material.id} value={material.id}>
                  {material.nome}
                </option>
              ))}
            </select>
          </div>

          {isQuente && (
            <div>
              <label className="label-field">Acabamento externo</label>
              <select
                className="input-field"
                value={especificacoes.acabamento_id ?? ""}
                onChange={(e) => setEspecificacoes({ acabamento_id: Number(e.target.value) })}
              >
                <option value="" disabled>
                  Selecione...
                </option>
                {acabamentos.map((acabamento) => (
                  <option key={acabamento.id} value={acabamento.id}>
                    {acabamento.nome} (ε = {acabamento.emissividade})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="label-field">Tipo de superfície</label>
            <select
              className="input-field"
              value={especificacoes.geometria}
              onChange={(e) => setEspecificacoes({ geometria: e.target.value as "plana" | "tubulacao" })}
            >
              <option value="tubulacao">Tubulação</option>
              <option value="plana">Superfície Plana</option>
            </select>
          </div>

          {isTubulacao && (
            <div>
              <label className="label-field">Diâmetro externo do tubo (mm)</label>
              <input
                type="number"
                className="input-field"
                value={especificacoes.diametro_mm ?? ""}
                onChange={(e) => setEspecificacoes({ diametro_mm: Number(e.target.value) })}
              />
            </div>
          )}

          <div>
            <label className="label-field">Área do projeto (m²)</label>
            <input
              type="number"
              step="0.01"
              className="input-field"
              value={especificacoes.area_m2}
              onChange={(e) => setEspecificacoes({ area_m2: Number(e.target.value) })}
            />
          </div>

          {!isTubulacao && (
            <div>
              <label className="label-field">Perímetro das emendas (m)</label>
              <input
                type="number"
                step="0.01"
                className="input-field"
                value={especificacoes.perimetro_m ?? ""}
                onChange={(e) => setEspecificacoes({ perimetro_m: Number(e.target.value) })}
              />
            </div>
          )}
        </div>
      </div>

      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <label className="label-field mb-0">Camadas de isolante (mm)</label>
          <button type="button" className="text-sm text-accent hover:underline" onClick={adicionarCamada}>
            + Adicionar camada
          </button>
        </div>
        <div className="flex flex-wrap gap-3">
          {especificacoes.espessuras_mm.map((espessura, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                type="number"
                className="input-field w-28"
                value={espessura}
                onChange={(e) => atualizarEspessura(index, Number(e.target.value))}
              />
              {especificacoes.espessuras_mm.length > 1 && (
                <button type="button" className="text-xs text-red-500" onClick={() => removerCamada(index)}>
                  remover
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="card grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="label-field">{isQuente ? "Temperatura da face quente (°C)" : "Temperatura interna (°C)"}</label>
          <input
            type="number"
            className="input-field"
            value={especificacoes.temperatura_quente}
            onChange={(e) => setEspecificacoes({ temperatura_quente: Number(e.target.value) })}
          />
        </div>
        <div>
          <label className="label-field">Temperatura ambiente (°C)</label>
          <input
            type="number"
            className="input-field"
            value={especificacoes.temperatura_ambiente}
            onChange={(e) => setEspecificacoes({ temperatura_ambiente: Number(e.target.value) })}
          />
        </div>
        <div>
          <label className="label-field">Velocidade do vento (m/s)</label>
          <input
            type="number"
            step="0.1"
            className="input-field"
            value={especificacoes.velocidade_vento_ms}
            onChange={(e) => setEspecificacoes({ velocidade_vento_ms: Number(e.target.value) })}
          />
        </div>
        {!isQuente && (
          <div>
            <label className="label-field">Umidade relativa do ar (%)</label>
            <input
              type="number"
              className="input-field"
              value={especificacoes.umidade_relativa}
              onChange={(e) => setEspecificacoes({ umidade_relativa: Number(e.target.value) })}
            />
          </div>
        )}
      </div>

      {isQuente && (
        <div className="card space-y-4">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={especificacoes.calcular_financeiro}
              onChange={(e) => setEspecificacoes({ calcular_financeiro: e.target.checked })}
            />
            Calcular retorno financeiro e ambiental (economia de energia / CO₂ evitado)
          </label>

          {especificacoes.calcular_financeiro && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="label-field">Combustível</label>
                <select
                  className="input-field"
                  value={especificacoes.combustivel}
                  onChange={(e) => setEspecificacoes({ combustivel: e.target.value as CombustivelTipo })}
                >
                  {COMBUSTIVEIS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label-field">Custo do combustível (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  className="input-field"
                  placeholder="usar valor de referência"
                  value={especificacoes.custo_combustivel ?? ""}
                  onChange={(e) => setEspecificacoes({ custo_combustivel: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="label-field">Horas de operação/dia</label>
                <input
                  type="number"
                  className="input-field"
                  value={especificacoes.horas_operacao_dia}
                  onChange={(e) => setEspecificacoes({ horas_operacao_dia: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="label-field">Dias de operação/semana</label>
                <input
                  type="number"
                  className="input-field"
                  value={especificacoes.dias_operacao_semana}
                  onChange={(e) => setEspecificacoes({ dias_operacao_semana: Number(e.target.value) })}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
