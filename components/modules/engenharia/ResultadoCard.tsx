"use client";

import { useState } from "react";
import { formatarNumero } from "@/lib/format";
import type { ResultadoFrio, ResultadoQuente } from "@/lib/usecases/engenharia";

interface Props {
  resultadoQuente: ResultadoQuente | null;
  resultadoFrio: ResultadoFrio | null;
  onCopiar: () => void;
}

/** Resultado básico do cálculo térmico — espessura, temperatura de face
 * fria e perda térmica, nos dois modos. O painel Frio no Python original só
 * mostra espessura + temperatura de orvalho (sem face fria/perda térmica);
 * aqui mostramos os dois a mais porque são fisicamente reais (não
 * inventados — saem da mesma função de convergência, só chamada mais uma
 * vez na espessura já encontrada — ver lib/usecases/engenharia/calcularFrio.ts). */
export default function ResultadoCard({ resultadoQuente, resultadoFrio, onCopiar }: Props) {
  const [copiado, setCopiado] = useState(false);

  if (!resultadoQuente && !resultadoFrio) return null;

  function copiar() {
    onCopiar();
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <div className={`card space-y-2 border-l-4 ${resultadoQuente ? "border-l-accent" : "border-l-brand"}`}>
      <h2 className="font-montserrat text-lg font-semibold text-brand">Resultado</h2>

      {resultadoQuente && (
        <>
          <p>
            ✅ Espessura necessária: <strong>{formatarNumero(resultadoQuente.espessura_mm, 1)} mm</strong>
          </p>
          <p>
            🌡️ Temperatura de face fria:{" "}
            <strong>{formatarNumero(resultadoQuente.temperatura_face_fria, 1)} °C</strong>
          </p>
          <p>📊 Perda térmica com isolante: {formatarNumero(resultadoQuente.perda_com_isolante_kw_m2, 3)} kW/m²</p>
          <p>📊 Perda térmica sem isolante: {formatarNumero(resultadoQuente.perda_sem_isolante_kw_m2, 3)} kW/m²</p>
        </>
      )}

      {resultadoFrio && (
        <>
          <p>
            ✅ Espessura mínima: <strong>{formatarNumero(resultadoFrio.espessura_minima_mm, 1)} mm</strong>
          </p>
          <p className="text-xs text-gray-500">Calculada para evitar condensação.</p>
          <p>💧 Temperatura de orvalho: {formatarNumero(resultadoFrio.temperatura_orvalho, 1)} °C</p>
          <p>
            🌡️ Temperatura de face fria alcançada:{" "}
            <strong>{formatarNumero(resultadoFrio.temperatura_face_fria, 1)} °C</strong>
          </p>
          <p>📊 Perda térmica com isolante: {formatarNumero(resultadoFrio.perda_com_isolante_kw_m2, 3)} kW/m²</p>
          <p>📊 Perda térmica sem isolante: {formatarNumero(resultadoFrio.perda_sem_isolante_kw_m2, 3)} kW/m²</p>
          <p className="mt-2 rounded-input bg-brand-light px-3 py-2 text-xs text-brand">
            💡 Futuro: análise de economia de energia para o modo frio.
          </p>
        </>
      )}

      <button type="button" className="btn-secondary mt-2" onClick={copiar}>
        {copiado ? "Copiado! ✓" : "Copiar resultado"}
      </button>
    </div>
  );
}
