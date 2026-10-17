"use client";

import { Trash2 } from "lucide-react";
import { useWizardStore } from "@/lib/store";
import { formatarMoeda, formatarNumero } from "@/lib/format";
import type { ConfigEmpresa, FormaContratacao, FuncaoMaoObra, LinhaEquipeMaoObra, MaoObraEquipe } from "@/lib/types";
import Explicacao from "@/components/ui/Explicacao";
import {
  FORMAS_CONTRATACAO,
  FUNCOES_MAO_OBRA,
  LABEL_FORMA_CONTRATACAO,
  LABEL_FUNCAO_MAO_OBRA,
  formaPadrao,
  funcaoProduz,
  parametrosEncargosDaConfig,
  rendimentoM2Dia,
  valorDiariaPadrao,
} from "@/lib/usecases/orcamento";

interface Props {
  config: ConfigEmpresa;
  /** Resultado já calculado para o que está na tela (trechos confirmados +,
   * na Tela 4, o trecho em edição) — quem usa o componente decide o que
   * entra na conta. */
  maoObra: MaoObraEquipe;
}

/** Equipe da proposta (migrações 048 e 056) — LINHAS de função + forma de
 * contratação + pessoas + diária combinada, para poder ter, por exemplo, 1
 * funileiro MEI e 1 funileiro pessoa física na mesma obra. Para cada linha
 * mostra o que a pessoa recebe (líquido), o que ela custa para a BR (bruto +
 * encargos: INSS e IR descontados da pessoa física, INSS patronal) e o
 * subtotal — é o custo real que entra no orçamento. O resultado (`maoObra`)
 * vem calculado de lib/hooks/useOrcamentoCalculado.ts. */
export default function EquipeMaoObra({ config, maoObra }: Props) {
  const { equipeLinhas, setEquipeLinhas, horasUteisDiaOverride, setHorasUteisDiaOverride, diasMaoObraManual, setDiasMaoObraManual } = useWizardStore();
  const encargos = parametrosEncargosDaConfig(config);
  const anexoIV = config.regime_tributario === "simples_nacional" && config.simples_nacional_anexo === "IV";

  const semEquipe = maoObra.pessoas === 0;
  const semRendimento = !semEquipe && maoObra.producao_m2_dia <= 0;
  const diasExatos = maoObra.horas_uteis_dia > 0 ? maoObra.horas_obra / maoObra.horas_uteis_dia : 0;

  function alterar(id: string, dados: Partial<LinhaEquipeMaoObra>) {
    setEquipeLinhas(equipeLinhas.map((l) => (l.id === id ? { ...l, ...dados } : l)));
  }
  function adicionar() {
    const funcao: FuncaoMaoObra = "isolador";
    setEquipeLinhas([...equipeLinhas, { id: `l-${Date.now()}`, funcao, forma: null, pessoas: 1, valor_diaria: null }]);
  }
  function remover(id: string) {
    setEquipeLinhas(equipeLinhas.filter((l) => l.id !== id));
  }

  return (
    <div className="card space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Mão de obra — equipe e diárias</h2>
        <p className="text-xs text-gray-500">
          Adicione cada mão de obra com a forma de contratação. Todos são cobrados pelos mesmos dias fechados; a diária é o valor combinado
          (o que a pessoa recebe) e o custo inclui os encargos.
        </p>
        <Explicacao titulo="Como os dias, os encargos e o valor são calculados">
          <p>
            A metragem de cada trecho, já ajustada pela eficiência, é dividida pela produção diária da equipe (soma de pessoas × rendimento
            da função). As horas de obra são arredondadas para cima em dias fechados de {formatarNumero(maoObra.horas_uteis_dia, 1)} h.
          </p>
          <p>
            <strong>MEI e PJ:</strong> o valor combinado é o valor da nota — custo igual ao combinado. <strong>MEI com INSS patronal</strong>{" "}
            (hidráulica, eletricidade, pintura, alvenaria, carpintaria — LC 123/2006, art. 18-B): +{formatarNumero(encargos.cpp_pct, 0)}%.
          </p>
          <p>
            <strong>Pessoa física (RPA):</strong> o combinado é o líquido. A BR paga um bruto maior, desconta e recolhe o INSS (
            {formatarNumero(encargos.inss_pf_pct, 0)}%, até o teto) e o IR (tabela mensal
            {encargos.reducao_irrf.ativa ? ", com a redução da Lei 15.270/2025" : ""})
            {encargos.iss_autonomo_pct > 0 ? ` e o ISS (${formatarNumero(encargos.iss_autonomo_pct, 2)}%)` : ""}. O cálculo é por pessoa e
            sempre pelo MÊS CHEIO ({encargos.dias_trabalho_mes} diárias): cada diária custa o mesmo que num mês completo, mesmo em obra curta —
            assim o orçamento nunca cobra menos (o IR sobe com o valor do mês, e a pessoa pode trabalhar em outras obras no mesmo mês).{" "}
            {encargos.cpp_sobre_pf
              ? `Fora do Simples Anexo III, a BR paga ainda ${formatarNumero(encargos.cpp_pct, 0)}% de INSS patronal sobre o bruto.`
              : "No Simples Anexo III o INSS patronal já está no DAS."}
          </p>
          <p>
            Atenção: alimentação ou transporte pagos em dinheiro à pessoa física, sem comprovante, contam como remuneração e entram na base
            do INSS e do IR. Pagos ao fornecedor (restaurante, transporte) ou reembolsados com nota, não entram.
          </p>
          <p>
            Diária, rendimento, forma padrão e parâmetros de INSS/IR ficam em{" "}
            <a href="/config-precos" className="text-brand hover:underline">
              Configurações do orçamento
            </a>
            . Diária em branco usa o valor de lá (em cinza).
          </p>
        </Explicacao>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="table-header">
            <tr>
              <th className="py-2 pr-3 text-left">Função</th>
              <th className="py-2 pr-3 text-left">Contratação</th>
              <th className="py-2 pr-3 text-left">Pessoas</th>
              <th className="py-2 pr-3 text-left">Diária combinada (líquido)</th>
              <th className="py-2 pr-3 text-right">Custo real / diária</th>
              <th className="py-2 pr-3 text-right">Subtotal</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {equipeLinhas.map((l) => {
              const r = maoObra.funcoes.find((f) => f.id === l.id);
              const forma: FormaContratacao = l.forma ?? formaPadrao(l.funcao, config);
              const custoDia = r && r.pessoas > 0 && r.diarias > 0 ? r.subtotal / (r.pessoas * r.diarias) : null;
              const acrescimo = r && (r.valor_pago ?? 0) > 0 ? ((r.encargos ?? 0) / (r.valor_pago ?? 1)) * 100 : 0;
              return (
                <tr key={l.id} className="align-top">
                  <td className="py-1.5 pr-3">
                    <select
                      aria-label="Função"
                      className="input-field w-44"
                      value={l.funcao}
                      onChange={(e) => alterar(l.id, { funcao: e.target.value as FuncaoMaoObra, valor_diaria: null, forma: l.forma })}
                    >
                      {FUNCOES_MAO_OBRA.map((f) => (
                        <option key={f} value={f}>
                          {LABEL_FUNCAO_MAO_OBRA[f]}
                        </option>
                      ))}
                    </select>
                    <span className="mt-0.5 block text-xs text-gray-400">
                      {funcaoProduz(l.funcao) ? `${formatarNumero(rendimentoM2Dia(l.funcao, config), 2)} m²/dia` : "não produz"}
                    </span>
                  </td>
                  <td className="py-1.5 pr-3">
                    <select
                      aria-label="Forma de contratação"
                      className="input-field w-48"
                      value={forma}
                      onChange={(e) => alterar(l.id, { forma: e.target.value as FormaContratacao })}
                    >
                      {forma === "nao_informada" && <option value="nao_informada">{LABEL_FORMA_CONTRATACAO.nao_informada}</option>}
                      {FORMAS_CONTRATACAO.map((f) => (
                        <option key={f} value={f}>
                          {LABEL_FORMA_CONTRATACAO[f]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-1.5 pr-3">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      aria-label="Pessoas"
                      className="input-field w-20"
                      value={l.pessoas}
                      onChange={(e) => alterar(l.id, { pessoas: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                    />
                  </td>
                  <td className="py-1.5 pr-3">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      aria-label="Diária combinada"
                      className="input-field w-28"
                      placeholder={String(valorDiariaPadrao(l.funcao, config))}
                      value={l.valor_diaria ?? ""}
                      onChange={(e) => alterar(l.id, { valor_diaria: e.target.value === "" ? null : Math.max(0, Number(e.target.value)) })}
                    />
                  </td>
                  <td className="py-1.5 pr-3 text-right">
                    {custoDia != null ? (
                      <>
                        <span className="font-medium">{formatarMoeda(custoDia)}</span>
                        {acrescimo > 0.005 && <span className="block text-xs text-amber-700">+{formatarNumero(acrescimo, 1)}% de encargos</span>}
                      </>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="py-1.5 pr-3 text-right">
                    <span className="font-medium">{formatarMoeda(r?.subtotal ?? 0)}</span>
                    {r && (r.encargos ?? 0) > 0 && (
                      <span className="block text-xs text-gray-500">
                        pago {formatarMoeda(r.valor_pago ?? 0)}
                        {(r.inss ?? 0) > 0 && ` · INSS ${formatarMoeda(r.inss ?? 0)}`}
                        {(r.irrf ?? 0) > 0 && ` · IR ${formatarMoeda(r.irrf ?? 0)}`}
                        {(r.iss ?? 0) > 0 && ` · ISS ${formatarMoeda(r.iss ?? 0)}`}
                        {(r.cpp ?? 0) > 0 && ` · patronal ${formatarMoeda(r.cpp ?? 0)}`}
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 text-right">
                    <button type="button" className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-status-error" aria-label="Remover linha" onClick={() => remover(l.id)}>
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <button type="button" className="btn-secondary" onClick={adicionar}>
        + Adicionar mão de obra
      </button>

      {/* Avisos de encargos */}
      {maoObra.funcoes.some((f) => f.forma === "pf" && (f.valor_pago ?? 0) > 0) && (
        <p className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800">
          Pessoa física calculada pelo mês cheio ({encargos.dias_trabalho_mes} diárias) — cada pessoa física custa{" "}
          {maoObra.funcoes
            .filter((f) => f.forma === "pf" && (f.valor_pago ?? 0) > 0)
            .map((f) => `${LABEL_FUNCAO_MAO_OBRA[f.funcao].toLowerCase()} +${formatarNumero(((f.encargos ?? 0) / (f.valor_pago ?? 1)) * 100, 0)}%`)
            .join(", ")}{" "}
          em relação a um MEI com a mesma diária.
        </p>
      )}
      {anexoIV && maoObra.funcoes.length > 0 && (
        <p className="rounded-lg bg-brand-light px-4 py-2 text-sm text-brand">
          Anexo IV do Simples: os {formatarNumero(encargos.cpp_pct, 0)}% de INSS patronal entram nas linhas de pessoa física, e o cliente vai
          reter 11% de INSS na nota de serviço — isso afeta o caixa (recebimento), não o preço.
        </p>
      )}
      {maoObra.funcoes.some((f) => f.forma === "nao_informada") && (
        <p className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-700">
          Orçamento anterior ao cálculo de encargos: as linhas com forma &quot;não informada&quot; estão sem encargos (valor de antes). Escolha a
          forma de contratação para incluir INSS, IR e INSS patronal.
        </p>
      )}

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
          <p className="mt-1 text-xs text-gray-500">Em branco = dia padrão. Menos horas úteis no local = mais dias e mais diárias.</p>
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
          <p className="mt-1 text-xs text-gray-500">Em branco = cálculo automático.</p>
        </div>
      </div>

      {semEquipe && (
        <p className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-700">
          Nenhuma pessoa na equipe — o orçamento está sem mão de obra. Adicione quem vai executar a obra.
        </p>
      )}
      {semRendimento && (
        <p className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-700">
          A equipe não tem ninguém que produza (só cargos sem rendimento, ou com rendimento zerado nas Configurações) — não dá para calcular os
          dias de obra. Inclua quem executa, cadastre o rendimento ou informe os dias à mão.
        </p>
      )}

      <div className="space-y-1 border-t border-gray-100 pt-3 text-sm">
        <LinhaResumo label="Trabalho (metragem ÷ eficiência)" valor={`${formatarNumero(maoObra.m2_equivalente, 2)} m² equivalentes`} />
        <LinhaResumo
          label={`Produção da equipe (${maoObra.pessoas} ${maoObra.pessoas === 1 ? "pessoa" : "pessoas"}${maoObra.funcoes.some((f) => !funcaoProduz(f.funcao)) ? ", TST não produz" : ""})`}
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
        <LinhaResumo label="Valor pago às pessoas (combinado)" valor={formatarMoeda(maoObra.valor_pago_pessoas ?? maoObra.valor_total)} />
        <LinhaResumo label="Encargos sobre a mão de obra" valor={formatarMoeda(maoObra.encargos_total ?? 0)} />
        <div className="flex justify-between border-t border-gray-200 pt-2 font-semibold">
          <span>Mão de obra da equipe (custo real)</span>
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
