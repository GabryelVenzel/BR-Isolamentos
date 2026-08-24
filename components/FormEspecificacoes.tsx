"use client";

import { useEffect, useState } from "react";
import { useWizardStore } from "@/lib/store";
import { somarMetragemEscopo } from "@/lib/usecases/orcamento";
import { formatarNumero } from "@/lib/format";
import type { CombustivelTipo, PrecoConfig } from "@/lib/types";

const COMBUSTIVEIS: Array<{ value: CombustivelTipo; label: string }> = [
  { value: "eletricidade", label: "Eletricidade (kWh)" },
  { value: "vapor", label: "Vapor (ton)" },
  { value: "gas_natural", label: "Gás Natural (m³)" },
  { value: "glp", label: "GLP (kg)" },
  { value: "oleo_diesel", label: "Óleo Diesel (L)" },
  { value: "oleo_bpf", label: "Óleo Combustível BPF (kg)" },
  { value: "lenha_eucalipto", label: "Lenha de Eucalipto (ton)" },
];

/** Tela 3 (refatorada) — um trecho é SEMPRE quente OU frio, nunca os dois
 * (removida a opção de múltiplas camadas mistas do wizard antigo). Geometria/
 * diâmetro/área não aparecem mais aqui — vêm do Escopo (Tela 2). Material e
 * acabamento agora escolhem uma linha do catálogo comercial por m²
 * (precos_config, migração 010), não mais o material "físico" direto — a
 * física (k(T)/emissividade) é resolvida por trás via
 * lib/usecases/orcamento/materialFisico.ts. */
export default function FormEspecificacoes() {
  const { itemAtual: especificacoes, setItemAtual: setEspecificacoes, escopoAtual } = useWizardStore();
  const [precos, setPrecos] = useState<PrecoConfig[]>([]);

  useEffect(() => {
    fetch("/api/precos-config")
      .then((r) => r.json())
      .then((lista: PrecoConfig[]) => setPrecos(lista.filter((p) => p.ativo)));
  }, []);

  const isQuente = especificacoes.tipo_trabalho === "quente";
  const isolantes = precos.filter((p) => p.tipo_material.startsWith("isolante_"));
  const acabamentos = precos.filter((p) => p.tipo_material.startsWith("chaparia_"));

  const metragemEscopo = somarMetragemEscopo(escopoAtual);
  const metragemFinal = especificacoes.metragem_editada ? (especificacoes.metragem_manual_m2 ?? 0) : metragemEscopo;

  return (
    <div className="space-y-6">
      <div className="card space-y-4">
        <div>
          <label className="label-field">Tipo de trabalho*</label>
          <div className="flex gap-4">
            {(["quente", "frio"] as const).map((tipo) => (
              <label key={tipo} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={especificacoes.tipo_trabalho === tipo}
                  onChange={() => setEspecificacoes({ tipo_trabalho: tipo })}
                />
                {tipo === "quente" ? "🔥 Térmico Quente" : "🧊 Térmico Frio"}
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label-field">Material isolante*</label>
            <select
              className="input-field"
              value={especificacoes.preco_isolante_id ?? ""}
              onChange={(e) => setEspecificacoes({ preco_isolante_id: Number(e.target.value) })}
            >
              <option value="" disabled>
                Selecione...
              </option>
              {isolantes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.descricao}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label-field">Acabamento externo*</label>
            <select
              className="input-field"
              value={especificacoes.preco_acabamento_id ?? ""}
              onChange={(e) => setEspecificacoes({ preco_acabamento_id: Number(e.target.value) })}
            >
              <option value="" disabled>
                Selecione...
              </option>
              {acabamentos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.descricao}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {isQuente && (
        <div className="card grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label-field">Espessura do isolante (mm)*</label>
            <input
              type="number"
              className="input-field"
              value={especificacoes.espessura_mm ?? ""}
              onChange={(e) => setEspecificacoes({ espessura_mm: e.target.value ? Number(e.target.value) : null })}
            />
          </div>
        </div>
      )}

      <div className="card grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="label-field">{isQuente ? "Temperatura da face quente (°C)*" : "Temperatura ambiente (°C)*"}</label>
          <input
            type="number"
            className="input-field"
            value={(isQuente ? especificacoes.temperatura_quente : especificacoes.temperatura_ambiente) ?? ""}
            onChange={(e) => {
              const valor = e.target.value === "" ? null : Number(e.target.value);
              setEspecificacoes(isQuente ? { temperatura_quente: valor } : { temperatura_ambiente: valor });
            }}
          />
        </div>
        <div>
          <label className="label-field">{isQuente ? "Temperatura ambiente (°C)*" : "Temperatura interna (°C)*"}</label>
          <input
            type="number"
            className="input-field"
            value={(isQuente ? especificacoes.temperatura_ambiente : especificacoes.temperatura_quente) ?? ""}
            onChange={(e) => {
              const valor = e.target.value === "" ? null : Number(e.target.value);
              setEspecificacoes(isQuente ? { temperatura_ambiente: valor } : { temperatura_quente: valor });
            }}
          />
        </div>

        {/* Velocidade do vento: removida do formulário Quente por pedido — o
            cálculo usa sempre 0 (ver step-3-especificacoes/page.tsx). No Frio
            continua editável, igual sempre foi. */}
        {!isQuente && (
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
        )}

        {!isQuente && (
          <div>
            <label className="label-field">Umidade relativa do ar (%)*</label>
            <input
              type="number"
              className="input-field"
              value={especificacoes.umidade_relativa ?? ""}
              onChange={(e) => setEspecificacoes({ umidade_relativa: e.target.value === "" ? null : Number(e.target.value) })}
            />
          </div>
        )}
      </div>

      {isQuente && (
        <div className="card space-y-4">
          <p className="text-sm font-medium text-gray-700">
            Cálculo de economia de energia <span className="text-xs font-normal text-gray-400">(obrigatório em trechos quentes)</span>
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="label-field">Combustível*</label>
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
              <label className="label-field">Preço do combustível (R$)*</label>
              <input
                type="number"
                step="0.01"
                className="input-field"
                value={especificacoes.custo_combustivel ?? ""}
                onChange={(e) => setEspecificacoes({ custo_combustivel: e.target.value ? Number(e.target.value) : null })}
              />
            </div>
            <div>
              <label className="label-field">Horas de operação/dia*</label>
              <input
                type="number"
                className="input-field"
                value={especificacoes.horas_operacao_dia}
                onChange={(e) => setEspecificacoes({ horas_operacao_dia: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="label-field">Dias de operação/semana*</label>
              <input
                type="number"
                className="input-field"
                value={especificacoes.dias_operacao_semana}
                onChange={(e) => setEspecificacoes({ dias_operacao_semana: Number(e.target.value) })}
              />
            </div>
          </div>
        </div>
      )}

      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <label className="label-field mb-0">Metragem total do trecho*</label>
          <label className="flex items-center gap-2 text-xs text-gray-500">
            <input
              type="checkbox"
              checked={especificacoes.metragem_editada}
              onChange={(e) => setEspecificacoes({ metragem_editada: e.target.checked })}
            />
            Editar metragem
          </label>
        </div>
        {especificacoes.metragem_editada ? (
          <input
            type="number"
            step="0.01"
            className="input-field"
            value={especificacoes.metragem_manual_m2 ?? ""}
            onChange={(e) => setEspecificacoes({ metragem_manual_m2: e.target.value ? Number(e.target.value) : null })}
          />
        ) : (
          <p className="font-montserrat text-xl font-bold text-brand">{formatarNumero(metragemEscopo, 2)} m²</p>
        )}
        <p className="text-xs text-gray-400">Vem da soma do Escopo (passo anterior); marque a caixa para sobrescrever.</p>
        {metragemFinal <= 0 && <p className="text-xs text-status-error">A metragem do trecho precisa ser maior que zero.</p>}
      </div>

      <div className="card">
        <label className="label-field">Mão de obra deste trecho (horas)</label>
        <input
          type="number"
          step="0.5"
          className="input-field sm:w-48"
          value={especificacoes.horas_mao_obra}
          onChange={(e) => setEspecificacoes({ horas_mao_obra: Number(e.target.value) })}
        />
      </div>
    </div>
  );
}
