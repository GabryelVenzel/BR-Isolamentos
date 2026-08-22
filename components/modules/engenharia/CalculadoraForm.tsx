"use client";

import NumberField from "./NumberField";
import type { Acabamento, Geometria, MaterialIsolante, TipoTrabalho } from "@/lib/types";

export interface EngenhariaFormState {
  tipoTrabalho: TipoTrabalho;
  materialId: number | undefined;
  /** Só usado em modo "quente" (o painel "frio" fixa emissividade em 0.9,
   * fiel ao Python — ver lib/usecases/engenharia/calcularFrio.ts). */
  acabamentoId: number | undefined;
  geometria: Geometria;
  diametroMm: number | undefined;
  /** Só usado em modo "quente" — no frio a espessura é o resultado do
   * cálculo, não uma entrada (ver Mudança 3 do pedido). */
  espessuraMm: number | undefined;
  /** Quente: temperatura da face quente. Frio: temperatura interna (pode
   * ser negativa — linha de água gelada, câmara fria). Mesmo campo nos dois
   * modos (nunca usados ao mesmo tempo), mesma convenção de nome já usada
   * no wizard de orçamento (lib/store.ts). */
  temperaturaQuente: number | undefined;
  temperaturaAmbiente: number | undefined;
  /** Só usado em modo "frio". */
  umidadeRelativa: number | undefined;
  /** Só usado em modo "frio" — o painel "quente" NUNCA tem esse campo (ver
   * Mudança 2: pior cenário térmico = sem ventilação, v_wind = 0 fixo). */
  velocidadeVentoMs: number | undefined;
}

interface Props {
  form: EngenhariaFormState;
  onChange: (patch: Partial<EngenhariaFormState>) => void;
  materiais: MaterialIsolante[];
  acabamentos: Acabamento[];
}

export default function CalculadoraForm({ form, onChange, materiais, acabamentos }: Props) {
  const isQuente = form.tipoTrabalho === "quente";
  const isTubulacao = form.geometria === "tubulacao";

  return (
    <div className="card space-y-4">
      <div>
        <label className="label-field">Tipo de trabalho</label>
        <div className="flex gap-4">
          {(["quente", "frio"] as const).map((tipo) => (
            <label key={tipo} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={form.tipoTrabalho === tipo}
                onChange={() => onChange({ tipoTrabalho: tipo })}
              />
              {tipo === "quente" ? "🔥 Quente" : "🧊 Frio (condensação)"}
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="label-field">
            Material isolante<span className="text-status-error"> *</span>
          </label>
          <select
            className="input-field"
            value={form.materialId ?? ""}
            onChange={(e) => onChange({ materialId: e.target.value ? Number(e.target.value) : undefined })}
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
            <label className="label-field">
              Acabamento externo<span className="text-status-error"> *</span>
            </label>
            <select
              className="input-field"
              value={form.acabamentoId ?? ""}
              onChange={(e) => onChange({ acabamentoId: e.target.value ? Number(e.target.value) : undefined })}
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
          <select
            className="input-field"
            value={form.geometria}
            onChange={(e) => onChange({ geometria: e.target.value as Geometria })}
          >
            <option value="tubulacao">Tubulação</option>
            <option value="plana">Superfície Plana</option>
          </select>
        </div>

        {isTubulacao && (
          <NumberField
            label="Diâmetro externo do tubo (mm)"
            required
            value={form.diametroMm}
            onChange={(v) => onChange({ diametroMm: v })}
          />
        )}

        {isQuente && (
          <NumberField
            label="Espessura do isolante (mm)"
            required
            value={form.espessuraMm}
            onChange={(v) => onChange({ espessuraMm: v })}
          />
        )}
      </div>

      {!isQuente && (
        <p className="rounded-input bg-brand-light px-3 py-2 text-xs text-brand">
          A espessura não é digitada aqui — é o resultado do cálculo (a menor espessura que evita condensação).
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <NumberField
          label={isQuente ? "Temperatura da face quente (°C)" : "Temperatura interna (°C)"}
          required
          value={form.temperaturaQuente}
          onChange={(v) => onChange({ temperaturaQuente: v })}
          helperText={!isQuente ? "Pode ser negativa (linha gelada, câmara fria)." : undefined}
        />
        <NumberField
          label="Temperatura ambiente (°C)"
          required
          value={form.temperaturaAmbiente}
          onChange={(v) => onChange({ temperaturaAmbiente: v })}
        />

        {!isQuente && (
          <>
            <NumberField
              label="Umidade relativa do ar (%)"
              required
              value={form.umidadeRelativa}
              onChange={(v) => onChange({ umidadeRelativa: v })}
            />
            <NumberField
              label="Velocidade do vento (m/s)"
              value={form.velocidadeVentoMs}
              onChange={(v) => onChange({ velocidadeVentoMs: v })}
              helperText="Deixe vazio (ou 0) para convecção natural — só o painel Frio tem esse campo."
            />
          </>
        )}
      </div>
    </div>
  );
}
