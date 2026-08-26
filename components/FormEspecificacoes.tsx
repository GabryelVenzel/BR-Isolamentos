"use client";

import { useEffect, useState } from "react";
import { useWizardStore } from "@/lib/store";
import { somarMetragemEscopo } from "@/lib/usecases/orcamento";
import { COMBUSTIVEIS as COMBUSTIVEIS_INFO } from "@/lib/calculadora-termica";
import { formatarMoeda, formatarNumero } from "@/lib/format";
import type { CombustivelTipo, PrecoConfig } from "@/lib/types";

// Mesma lista/ordem de components/modules/engenharia/EconomiaSection.tsx —
// os rótulos/unidades vêm de lib/calculadora-termica.ts#COMBUSTIVEIS (única
// fonte), não duplicados aqui como um array próprio.
const COMBUSTIVEL_OPCOES: CombustivelTipo[] = [
  "eletricidade",
  "gas_natural",
  "glp",
  "oleo_diesel",
  "oleo_bpf",
  "vapor",
  "lenha_eucalipto",
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

  // Pré-preenche o preço de referência do combustível assim que o trecho
  // vira "quente" (mesmo mecanismo — e mesma tabela — que a calculadora
  // rápida de Engenharia já usa em EconomiaSection.tsx: lib/calculadora-termica.ts#COMBUSTIVEIS,
  // única fonte de verdade pros dois lugares). Sem isso o campo ficava vazio
  // até o usuário digitar um valor do zero, mesmo já existindo uma
  // referência validada disponível.
  useEffect(() => {
    if (especificacoes.tipo_trabalho === "quente" && especificacoes.custo_combustivel === null) {
      setEspecificacoes({ custo_combustivel: COMBUSTIVEIS_INFO[especificacoes.combustivel].v });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [especificacoes.tipo_trabalho]);

  function selecionarCombustivel(combustivel: CombustivelTipo) {
    // Pré-preenche o preço com o valor de referência — o usuário pode
    // ajustar em seguida pra refletir o contrato real (mesmo comportamento
    // de EconomiaSection.tsx).
    setEspecificacoes({ combustivel, custo_combustivel: COMBUSTIVEIS_INFO[combustivel].v });
  }

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
              value={especificacoes.isolante_customizado_nome != null ? "outro" : especificacoes.preco_isolante_id ?? ""}
              onChange={(e) =>
                e.target.value === "outro"
                  ? setEspecificacoes({ preco_isolante_id: null, isolante_customizado_nome: "" })
                  : setEspecificacoes({ preco_isolante_id: Number(e.target.value), isolante_customizado_nome: null, isolante_customizado_preco_m2: null })
              }
            >
              <option value="" disabled>
                Selecione...
              </option>
              {isolantes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.descricao}
                </option>
              ))}
              <option value="outro">➕ Outro material</option>
            </select>
            {especificacoes.isolante_customizado_nome != null && (
              <div className="mt-2 space-y-2 rounded-lg border border-dashed border-gray-300 p-3">
                <p className="text-xs text-amber-600">
                  ⚠️ Material customizado — sem dado técnico cadastrado. Este trecho não terá cálculo de perda
                  térmica/economia, só quantificação e preço.
                </p>
                <div>
                  <label className="label-field">Nome do material</label>
                  <input
                    className="input-field"
                    value={especificacoes.isolante_customizado_nome}
                    onChange={(e) => setEspecificacoes({ isolante_customizado_nome: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label-field">Preço por m² (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input-field"
                    value={especificacoes.isolante_customizado_preco_m2 ?? ""}
                    onChange={(e) =>
                      setEspecificacoes({ isolante_customizado_preco_m2: e.target.value ? Number(e.target.value) : null })
                    }
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="label-field">Acabamento externo*</label>
            <select
              className="input-field"
              value={especificacoes.acabamento_customizado_nome != null ? "outro" : especificacoes.preco_acabamento_id ?? ""}
              onChange={(e) =>
                e.target.value === "outro"
                  ? setEspecificacoes({ preco_acabamento_id: null, acabamento_customizado_nome: "" })
                  : setEspecificacoes({ preco_acabamento_id: Number(e.target.value), acabamento_customizado_nome: null, acabamento_customizado_preco_m2: null })
              }
            >
              <option value="" disabled>
                Selecione...
              </option>
              {acabamentos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.descricao}
                </option>
              ))}
              <option value="outro">➕ Outro material</option>
            </select>
            {especificacoes.acabamento_customizado_nome != null && (
              <div className="mt-2 space-y-2 rounded-lg border border-dashed border-gray-300 p-3">
                {isQuente && (
                  <p className="text-xs text-amber-600">
                    ⚠️ Acabamento customizado — sem emissividade cadastrada. Este trecho não terá cálculo de perda
                    térmica/economia, só quantificação e preço.
                  </p>
                )}
                <div>
                  <label className="label-field">Nome do acabamento</label>
                  <input
                    className="input-field"
                    value={especificacoes.acabamento_customizado_nome}
                    onChange={(e) => setEspecificacoes({ acabamento_customizado_nome: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label-field">Preço por m² (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input-field"
                    value={especificacoes.acabamento_customizado_preco_m2 ?? ""}
                    onChange={(e) =>
                      setEspecificacoes({ acabamento_customizado_preco_m2: e.target.value ? Number(e.target.value) : null })
                    }
                  />
                </div>
              </div>
            )}
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
                onChange={(e) => selecionarCombustivel(e.target.value as CombustivelTipo)}
              >
                {COMBUSTIVEL_OPCOES.map((c) => (
                  <option key={c} value={c}>
                    {COMBUSTIVEIS_INFO[c].label} ({COMBUSTIVEIS_INFO[c].unidade})
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
              <p className="mt-1 text-xs text-gray-400">
                Referência: {formatarMoeda(COMBUSTIVEIS_INFO[especificacoes.combustivel].v)}/
                {COMBUSTIVEIS_INFO[especificacoes.combustivel].unidade} — ajuste conforme o contrato real.
              </p>
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

      {/* Mão de obra deste trecho: removida (era um campo manual em horas) —
          agora é calculada automaticamente na Tela 4, a partir da metragem e
          dos fatores de eficiência (tubulação pequena/curvas/altura, ver
          calcularMaoObraAutomatica.ts). */}
    </div>
  );
}
