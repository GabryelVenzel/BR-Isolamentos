"use client";

import { useEffect, useState } from "react";
import { formatarNumero } from "@/lib/format";
import type {
  Acabamento,
  CalcularTermicoInput,
  CalcularTermicoResultadoFrio,
  CalcularTermicoResultadoQuente,
  Geometria,
  MaterialIsolante,
  TipoTrabalho,
} from "@/lib/types";

/**
 * Calculadora rápida quente/frio — módulo Engenharia. Roda só o cálculo
 * térmico (ASTM C680 / ISO 12241 / ABNT NBR 16281) para uma estimativa
 * imediata em campo, sem quantificar materiais nem gerar orçamento (isso
 * continua sendo função do wizard "Novo Orçamento", que também persiste os
 * dados a um cliente). Estado 100% local — não usa o store do wizard.
 */
export default function EngenhariaPage() {
  const [materiais, setMateriais] = useState<MaterialIsolante[]>([]);
  const [acabamentos, setAcabamentos] = useState<Acabamento[]>([]);

  const [tipoTrabalho, setTipoTrabalho] = useState<TipoTrabalho>("quente");
  const [materialId, setMaterialId] = useState<number | null>(null);
  const [acabamentoId, setAcabamentoId] = useState<number | null>(null);
  const [geometria, setGeometria] = useState<Geometria>("tubulacao");
  const [diametroMm, setDiametroMm] = useState(88.9);
  const [espessuraMm, setEspessuraMm] = useState(51);
  const [temperaturaQuente, setTemperaturaQuente] = useState(200);
  const [temperaturaAmbiente, setTemperaturaAmbiente] = useState(30);
  const [velocidadeVento, setVelocidadeVento] = useState(0);
  const [umidadeRelativa, setUmidadeRelativa] = useState(70);

  const [calculando, setCalculando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultadoQuente, setResultadoQuente] = useState<CalcularTermicoResultadoQuente | null>(null);
  const [resultadoFrio, setResultadoFrio] = useState<CalcularTermicoResultadoFrio | null>(null);

  useEffect(() => {
    fetch("/api/materiais").then((r) => r.json()).then(setMateriais);
    fetch("/api/acabamentos").then((r) => r.json()).then(setAcabamentos);
  }, []);

  const material = materiais.find((m) => m.id === materialId);
  const acabamento = acabamentos.find((a) => a.id === acabamentoId);
  const isQuente = tipoTrabalho === "quente";
  const isTubulacao = geometria === "tubulacao";

  async function calcular() {
    if (!material) {
      setErro("Selecione um material isolante.");
      return;
    }
    setErro(null);
    setCalculando(true);
    setResultadoQuente(null);
    setResultadoFrio(null);

    try {
      const payload: CalcularTermicoInput = {
        tipo_trabalho: tipoTrabalho,
        material_k_func: material.k_func,
        t_min: material.t_min,
        t_max: material.t_max,
        emissividade: acabamento?.emissividade ?? 0.9,
        geometria,
        diametro_mm: isTubulacao ? diametroMm : undefined,
        espessuras_mm: [espessuraMm],
        temperatura_quente: temperaturaQuente,
        temperatura_ambiente: temperaturaAmbiente,
        velocidade_vento_ms: velocidadeVento,
        umidade_relativa: isQuente ? undefined : umidadeRelativa,
      };

      const response = await fetch("/api/calcular-termico", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const dados = await response.json();

      if (!response.ok) {
        setErro(dados.error ?? "Erro no cálculo térmico.");
        return;
      }

      if (isQuente) setResultadoQuente(dados);
      else setResultadoFrio(dados);
    } catch {
      setErro("Erro de conexão ao calcular.");
    } finally {
      setCalculando(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Engenharia</h1>
        <p className="text-sm text-gray-500">
          Cálculo térmico rápido (quente ou frio) — sem quantificação de materiais nem orçamento. Para gerar uma
          proposta completa, use "Orçamento → Novo Orçamento".
        </p>
      </div>

      <div className="card space-y-4">
        <div>
          <label className="label-field">Tipo de trabalho</label>
          <div className="flex gap-4">
            {(["quente", "frio"] as const).map((tipo) => (
              <label key={tipo} className="flex items-center gap-2 text-sm">
                <input type="radio" checked={tipoTrabalho === tipo} onChange={() => setTipoTrabalho(tipo)} />
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
              value={materialId ?? ""}
              onChange={(e) => setMaterialId(Number(e.target.value))}
            >
              <option value="" disabled>
                Selecione...
              </option>
              {materiais.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
            </select>
          </div>

          {isQuente && (
            <div>
              <label className="label-field">Acabamento externo</label>
              <select
                className="input-field"
                value={acabamentoId ?? ""}
                onChange={(e) => setAcabamentoId(Number(e.target.value))}
              >
                <option value="" disabled>
                  Selecione...
                </option>
                {acabamentos.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nome} (ε = {a.emissividade})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="label-field">Tipo de superfície</label>
            <select className="input-field" value={geometria} onChange={(e) => setGeometria(e.target.value as Geometria)}>
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
                value={diametroMm}
                onChange={(e) => setDiametroMm(Number(e.target.value))}
              />
            </div>
          )}

          <div>
            <label className="label-field">Espessura do isolante (mm)</label>
            <input
              type="number"
              className="input-field"
              value={espessuraMm}
              onChange={(e) => setEspessuraMm(Number(e.target.value))}
              disabled={!isQuente}
            />
            {!isQuente && <p className="mt-1 text-xs text-gray-400">No modo frio, a espessura mínima é calculada.</p>}
          </div>
        </div>
      </div>

      <div className="card grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="label-field">{isQuente ? "Temperatura da face quente (°C)" : "Temperatura interna (°C)"}</label>
          <input
            type="number"
            className="input-field"
            value={temperaturaQuente}
            onChange={(e) => setTemperaturaQuente(Number(e.target.value))}
          />
        </div>
        <div>
          <label className="label-field">Temperatura ambiente (°C)</label>
          <input
            type="number"
            className="input-field"
            value={temperaturaAmbiente}
            onChange={(e) => setTemperaturaAmbiente(Number(e.target.value))}
          />
        </div>
        <div>
          <label className="label-field">Velocidade do vento (m/s)</label>
          <input
            type="number"
            step="0.1"
            className="input-field"
            value={velocidadeVento}
            onChange={(e) => setVelocidadeVento(Number(e.target.value))}
          />
        </div>
        {!isQuente && (
          <div>
            <label className="label-field">Umidade relativa do ar (%)</label>
            <input
              type="number"
              className="input-field"
              value={umidadeRelativa}
              onChange={(e) => setUmidadeRelativa(Number(e.target.value))}
            />
          </div>
        )}
      </div>

      <div className="card">
        <button type="button" className="btn-primary" onClick={calcular} disabled={calculando || !material}>
          {calculando ? "Calculando..." : "Calcular"}
        </button>
        {erro && <p className="mt-3 text-sm text-status-error">{erro}</p>}
      </div>

      {resultadoQuente && (
        <div className="card space-y-2 border-l-4 border-accent">
          <h2 className="font-montserrat text-lg font-semibold text-brand">Resultado térmico</h2>
          <p>
            🌡️ Temperatura da face fria: <strong>{formatarNumero(resultadoQuente.temperatura_face_fria, 1)} °C</strong>
          </p>
          <p>⚡ Perda de calor com isolante: {formatarNumero(resultadoQuente.perda_com_isolante_kw_m2, 3)} kW/m²</p>
          <p>⚡ Perda de calor sem isolante: {formatarNumero(resultadoQuente.perda_sem_isolante_kw_m2, 3)} kW/m²</p>
        </div>
      )}

      {resultadoFrio && (
        <div className="card space-y-2 border-l-4 border-brand">
          <h2 className="font-montserrat text-lg font-semibold text-brand">Resultado — prevenção de condensação</h2>
          <p>💧 Temperatura de orvalho: {formatarNumero(resultadoFrio.temperatura_orvalho, 1)} °C</p>
          <p>
            ✅ Espessura mínima recomendada:{" "}
            <strong>{formatarNumero(resultadoFrio.espessura_minima_mm ?? 0, 1)} mm</strong>
          </p>
        </div>
      )}
    </div>
  );
}
