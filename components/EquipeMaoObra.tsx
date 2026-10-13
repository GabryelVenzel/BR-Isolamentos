"use client";

import { useWizardStore } from "@/lib/store";
import { formatarMoeda, formatarNumero } from "@/lib/format";
import type { ConfigEmpresa, MaoObraEquipe } from "@/lib/types";
import { FUNCOES_MAO_OBRA, LABEL_FUNCAO_MAO_OBRA, rendimentoM2Dia, valorDiariaPadrao } from "@/lib/usecases/orcamento";

interface Props {
  config: ConfigEmpresa;
  /** Resultado já calculado para o que está na tela (trechos confirmados +,
   * na Tela 4, o trecho em edição) — quem usa o componente decide o que
   * entra na conta. */
  maoObra: MaoObraEquipe;
}

/** Equipe e diárias da mão de obra (migração 048) — vale para o orçamento
 * inteiro. Escolhe quantas pessoas de cada função, e mostra como a metragem
 * vira horas de obra, dias fechados e valor. Usado na Tela 4 (Preços) e na
 * Tela 5 (Revisão); só lê e grava o estado do wizard, não recalcula o
 * orçamento — quem usa reage às mudanças. */
export default function EquipeMaoObra({ config, maoObra }: Props) {
  const {
    equipe,
    setEquipe,
    valoresDiariaOverride,
    setValorDiariaOverride,
    horasUteisDiaOverride,
    setHorasUteisDiaOverride,
    diasMaoObraManual,
    setDiasMaoObraManual,
  } = useWizardStore();

  const semEquipe = maoObra.pessoas === 0;
  const semRendimento = !semEquipe && maoObra.producao_m2_dia <= 0;
  const diasExatos = maoObra.horas_uteis_dia > 0 ? maoObra.horas_obra / maoObra.horas_uteis_dia : 0;

  return (
    <div className="card space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Mão de obra — equipe e diárias</h2>
        <p className="text-xs text-gray-400">
          Vale para o orçamento inteiro (todos os trechos juntos). A metragem de cada trecho, já ajustada pela eficiência,
          é dividida pela produção diária da equipe; as horas de obra são sempre arredondadas para cima em dias fechados de{" "}
          {formatarNumero(maoObra.horas_uteis_dia, 1)} h, e cada pessoa da equipe é cobrada por esses dias. Rendimento e
          valor de diária de cada função vêm de{" "}
          <a href="/config-precos" className="text-brand hover:underline">
            Configurar Preços
          </a>
          .
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="table-header">
            <tr>
              <th className="py-2 pr-4 text-left">Função</th>
              <th className="py-2 pr-4 text-left">Pessoas</th>
              <th className="py-2 pr-4 text-right">Rendimento</th>
              <th className="py-2 pr-4 text-left">Diária (R$)</th>
              <th className="py-2 pr-4 text-right">Diárias</th>
              <th className="py-2 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {FUNCOES_MAO_OBRA.map((funcao) => {
              const linha = maoObra.funcoes.find((f) => f.funcao === funcao);
              const padrao = valorDiariaPadrao(funcao, config);
              const ajustado = valoresDiariaOverride[funcao];
              return (
                <tr key={funcao}>
                  <td className="py-1.5 pr-4 font-medium">{LABEL_FUNCAO_MAO_OBRA[funcao]}</td>
                  <td className="py-1.5 pr-4">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      aria-label={`Quantidade de ${LABEL_FUNCAO_MAO_OBRA[funcao].toLowerCase()}`}
                      className="input-field w-20"
                      value={equipe[funcao]}
                      onChange={(e) => setEquipe({ [funcao]: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                    />
                  </td>
                  <td className="py-1.5 pr-4 text-right text-gray-500">{formatarNumero(rendimentoM2Dia(funcao, config), 2)} m²/dia</td>
                  <td className="py-1.5 pr-4">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      aria-label={`Valor da diária de ${LABEL_FUNCAO_MAO_OBRA[funcao].toLowerCase()}`}
                      className="input-field w-28"
                      placeholder={String(padrao)}
                      value={ajustado ?? ""}
                      onChange={(e) => setValorDiariaOverride(funcao, e.target.value === "" ? null : Math.max(0, Number(e.target.value)))}
                    />
                  </td>
                  <td className="py-1.5 pr-4 text-right text-gray-500">{linha ? `${linha.pessoas} × ${linha.diarias}` : "—"}</td>
                  <td className="py-1.5 text-right font-medium">{formatarMoeda(linha?.subtotal ?? 0)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400">
        Diária em branco usa o valor de Configurar Preços (mostrado em cinza); preencha só para ajustar o valor neste orçamento.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label-field">Horas úteis de serviço por dia (este orçamento)</label>
          <input
            type="number"
            step="0.1"
            min={0}
            className="input-field max-w-xs"
            placeholder={`Padrão: ${formatarNumero(config.horas_uteis_dia, 1)}h`}
            value={horasUteisDiaOverride ?? ""}
            onChange={(e) => setHorasUteisDiaOverride(e.target.value ? Number(e.target.value) : null)}
          />
          <p className="mt-1 text-xs text-gray-400">
            Deixe em branco para o dia padrão. Se deslocamento ou liberação de acesso reduzem o tempo produtivo neste local,
            informe as horas realmente úteis — a obra leva mais dias e as diárias aumentam junto.
          </p>
        </div>
        <div>
          <label className="label-field">Dias de obra (ajuste manual)</label>
          <input
            type="number"
            step={1}
            min={0}
            className="input-field max-w-xs"
            placeholder="Automático"
            value={diasMaoObraManual ?? ""}
            onChange={(e) => setDiasMaoObraManual(e.target.value === "" ? null : Math.max(0, Math.floor(Number(e.target.value) || 0)))}
          />
          <p className="mt-1 text-xs text-gray-400">Deixe em branco para o cálculo automático. Preencha só para fixar a quantidade de dias à mão.</p>
        </div>
      </div>

      {semEquipe && (
        <p className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-700">
          Nenhuma pessoa na equipe — o orçamento está sem mão de obra. Informe quantos funileiros, isoladores e ajudantes.
        </p>
      )}
      {semRendimento && (
        <p className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-700">
          As funções escolhidas estão com rendimento zerado em Configurar Preços — não dá para calcular os dias de obra.
          Cadastre o rendimento ou informe os dias à mão.
        </p>
      )}

      <div className="space-y-1 border-t border-gray-100 pt-3 text-sm">
        <LinhaResumo
          label="Trabalho (metragem ÷ eficiência)"
          valor={`${formatarNumero(maoObra.m2_equivalente, 2)} m² equivalentes`}
        />
        <LinhaResumo
          label={`Produção da equipe (${maoObra.pessoas} ${maoObra.pessoas === 1 ? "pessoa" : "pessoas"})`}
          valor={`${formatarNumero(maoObra.producao_m2_dia, 2)} m²/dia`}
        />
        <LinhaResumo label="Horas de obra" valor={`${formatarNumero(maoObra.horas_obra, 1)} h`} />
        <LinhaResumo
          label="Dias de obra"
          valor={
            maoObra.dias_manual
              ? `${maoObra.dias} (ajuste manual — o cálculo daria ${Math.ceil(Number(diasExatos.toFixed(6)))})`
              : `${maoObra.dias} (${formatarNumero(maoObra.horas_obra, 1)} h ÷ ${formatarNumero(maoObra.horas_uteis_dia, 1)} h = ${formatarNumero(diasExatos, 1)}, arredondado para cima)`
          }
        />
        <div className="flex justify-between border-t border-gray-200 pt-2 font-semibold">
          <span>Mão de obra da equipe</span>
          <span>{formatarMoeda(maoObra.valor_total)}</span>
        </div>
      </div>
    </div>
  );
}

function LinhaResumo({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-gray-500">{label}</span>
      <span className="text-right font-medium text-gray-800">{valor}</span>
    </div>
  );
}
