"use client";

import { useEffect, useState } from "react";
import NumberField from "./NumberField";
import { formatarMoeda, formatarNumero } from "@/lib/format";
import { COMBUSTIVEIS } from "@/lib/calculadora-termica";
import type { CombustivelTipo } from "@/lib/types";
import type { ResultadoEconomia } from "@/lib/usecases/engenharia";

export interface EconomiaFormState {
  combustivel: CombustivelTipo;
  custoCombustivel: number | undefined;
  /** Horas/dia + dias/semana (não "horas/ano" direto) — mesmo padrão do
   * wizard de orçamento, a média mensal/anual fica implícita no cálculo
   * (ver lib/calculadora-termica.ts#calcularEconomiaECO2). */
  horasOperacaoDia: number | undefined;
  diasOperacaoSemana: number | undefined;
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
 * marcar o checkbox, expande os campos (combustível, preço, horas/dia,
 * dias/semana). O botão "Calcular" da página é quem dispara o cálculo —
 * esta seção só coleta os inputs e, depois de calculado, mostra o
 * resultado.
 *
 * Eficiência do equipamento NÃO é um campo editável — já é uma média por
 * tipo de combustível embutida em `COMBUSTIVEIS[combustivel].ef`
 * (lib/calculadora-termica.ts, dado pesquisado e validado). Só é mostrada
 * como referência (read-only), pra deixar claro qual valor está sendo
 * considerado no cálculo. */
export default function EconomiaSection({ ativo, onToggle, form, onChange, resultado, onCopiar }: Props) {
  const [copiado, setCopiado] = useState(false);
  const combustivelInfo = COMBUSTIVEIS[form.combustivel];

  // Pré-preenche o preço de referência assim que a seção é ativada (não só
  // quando o usuário troca manualmente de combustível no select) — sem
  // isso, o combustível padrão ("eletricidade") ficava com o campo de
  // preço vazio até o usuário mexer no select, mesmo já tendo um valor de
  // referência disponível.
  useEffect(() => {
    if (ativo && form.custoCombustivel === undefined) {
      onChange({ custoCombustivel: COMBUSTIVEIS[form.combustivel].v });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo]);

  function selecionarCombustivel(combustivel: CombustivelTipo) {
    // Pré-preenche o preço com o valor de referência já validado — o
    // usuário pode ajustar em seguida pra refletir o contrato real.
    onChange({ combustivel, custoCombustivel: COMBUSTIVEIS[combustivel].v });
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
              helperText={`Referência: ${formatarMoeda(combustivelInfo.v)}/${combustivelInfo.unidade} — ajuste conforme o contrato real.`}
            />
            <NumberField
              label="Horas de operação/dia"
              required
              value={form.horasOperacaoDia}
              onChange={(v) => onChange({ horasOperacaoDia: v })}
            />
            <NumberField
              label="Dias de operação/semana"
              required
              value={form.diasOperacaoSemana}
              onChange={(v) => onChange({ diasOperacaoSemana: v })}
            />
          </div>

          {/* Eficiência: só leitura — não é um dado que o usuário preenche
              (ver comentário no topo do arquivo). */}
          <p className="rounded-input bg-brand-light px-3 py-2 text-xs text-brand">
            Eficiência considerada para {combustivelInfo.label}:{" "}
            <strong>{formatarNumero(combustivelInfo.ef * 100, 0)}%</strong> (valor de referência do sistema, não
            editável).
          </p>

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
