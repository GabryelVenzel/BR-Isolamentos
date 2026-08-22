"use client";

import { useState } from "react";
import NumberField from "./NumberField";
import { formatarMoeda, formatarNumero } from "@/lib/format";
import { COMBUSTIVEIS } from "@/lib/calculadora-termica";
import type { CombustivelTipo } from "@/lib/types";
import type { ResultadoEconomia } from "@/lib/usecases/engenharia";

export interface EconomiaFormState {
  combustivel: CombustivelTipo;
  custoCombustivel: number | undefined;
  eficienciaPercentual: number | undefined;
  horasOperacaoAno: number | undefined;
  valorInvestimento: number | undefined;
  /** A perda térmica que o cálculo devolve é por m² (kW/m²) — sem a área
   * real da superfície isolada, a "economia" viraria só um valor por metro
   * quadrado, bem menor do que a economia real do projeto inteiro. Por
   * isso esse campo é obrigatório aqui mesmo sem aparecer no mockup
   * original do pedido. */
  areaM2: number | undefined;
}

interface Props {
  ativo: boolean;
  onToggle: (ativo: boolean) => void;
  form: EconomiaFormState;
  onChange: (patch: Partial<EconomiaFormState>) => void;
  resultado: ResultadoEconomia | null;
  onCopiar: () => void;
}

const COMBUSTIVEL_OPCOES: CombustivelTipo[] = [
  "eletricidade",
  "gas_natural",
  "glp",
  "oleo_diesel",
  "oleo_bpf",
  "vapor",
  "lenha_eucalipto",
];

/** Seção de economia de energia — só existe no painel Quente (ver
 * checklist do pedido: FRIO não tem essa seção). Começa colapsada; ao
 * marcar o checkbox, expande os campos (combustível, preço, eficiência,
 * horas/ano). O botão "Calcular" da página é quem dispara o cálculo — esta
 * seção só coleta os inputs e, depois de calculado, mostra o resultado. */
export default function EconomiaSection({ ativo, onToggle, form, onChange, resultado, onCopiar }: Props) {
  const [copiado, setCopiado] = useState(false);
  const combustivelInfo = COMBUSTIVEIS[form.combustivel];

  function selecionarCombustivel(combustivel: CombustivelTipo) {
    // Pré-preenche preço e eficiência com os valores de referência já
    // validados (lib/calculadora-termica.ts) — o usuário pode ajustar em
    // seguida pra refletir o contrato/equipamento real.
    const info = COMBUSTIVEIS[combustivel];
    onChange({ combustivel, custoCombustivel: info.v, eficienciaPercentual: Math.round(info.ef * 100) });
  }

  async function copiar() {
    onCopiar();
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <div className="card">
      <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
        <input type="checkbox" checked={ativo} onChange={(e) => onToggle(e.target.checked)} />
        Calcular economia de energia também
      </label>

      {ativo && (
        <div className="mt-4 space-y-4 border-t border-gray-100 pt-4">
          <NumberField
            label="Área da superfície isolada (m²)"
            required
            value={form.areaM2}
            onChange={(v) => onChange({ areaM2: v })}
            helperText="A perda térmica do cálculo é por m² — a economia total depende da área real do projeto."
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="label-field">
                Combustível<span className="text-status-error"> *</span>
              </label>
              <select
                className="input-field"
                value={form.combustivel}
                onChange={(e) => selecionarCombustivel(e.target.value as CombustivelTipo)}
              >
                {COMBUSTIVEL_OPCOES.map((c) => (
                  <option key={c} value={c}>
                    {COMBUSTIVEIS[c].label}
                  </option>
                ))}
              </select>
            </div>
            <NumberField
              label={`Preço (R$/${combustivelInfo.unidade})`}
              required
              value={form.custoCombustivel}
              onChange={(v) => onChange({ custoCombustivel: v })}
              helperText="Pré-preenchido com valor de referência — ajuste conforme o contrato real."
            />
            <NumberField
              label="Eficiência do equipamento (%)"
              required
              value={form.eficienciaPercentual}
              onChange={(v) => onChange({ eficienciaPercentual: v })}
            />
            <NumberField
              label="Horas de operação/ano"
              required
              value={form.horasOperacaoAno}
              onChange={(v) => onChange({ horasOperacaoAno: v })}
              helperText="Máx. 8760h (24h × 365 dias)."
            />
          </div>
          <NumberField
            label="Valor do investimento (R$) — opcional, só para estimar o ROI"
            value={form.valorInvestimento}
            onChange={(v) => onChange({ valorInvestimento: v })}
          />
        </div>
      )}

      {ativo && resultado && (
        <div className="mt-4 space-y-2 rounded-card border-l-4 border-l-accent bg-accent-light/50 p-4">
          <h3 className="font-montserrat text-sm font-bold uppercase text-brand">💰 Economia Anual</h3>
          <p>• Economia de energia: {formatarNumero(resultado.economia_anual_kwh, 0)} kWh/ano</p>
          <p>• Economia financeira: {formatarMoeda(resultado.economia_financeira_anual)}/ano</p>
          {resultado.roi_meses !== null && <p>• ROI estimado: {formatarNumero(resultado.roi_meses, 0)} meses</p>}
          <p>• Redução de CO₂: {formatarNumero(resultado.co2_reduzido_ton_ano, 2)} ton CO₂/ano</p>

          <button type="button" className="btn-accent mt-2" onClick={copiar}>
            {copiado ? "Copiado! ✓" : "Copiar para proposta"}
          </button>
        </div>
      )}
    </div>
  );
}
