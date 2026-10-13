"use client";

import { useRouter } from "next/navigation";
import EquipeMaoObra from "@/components/EquipeMaoObra";
import { formatarMoeda, formatarNumero } from "@/lib/format";
import { useOrcamentoCalculado } from "@/lib/hooks/useOrcamentoCalculado";
import { useWizardStore } from "@/lib/store";

/** Etapa 5 — o que vale para o ORÇAMENTO INTEIRO, uma vez só: a equipe de mão
 * de obra (com as diárias) e os custos operacionais. Antes esses quadros
 * ficavam na Tela 4 e se repetiam a cada trecho. Tudo aqui é recalculado na
 * hora (ver lib/hooks/useOrcamentoCalculado.ts) — a barra de totais no rodapé
 * acompanha. */
export default function Step5EquipePage() {
  const router = useRouter();
  const { itens, custosOperacionais, setCustosOperacionais, editarItem } = useWizardStore();
  const { config, trechos, maoObra, resultado } = useOrcamentoCalculado();

  // Voltar = reabrir o último trecho na Tela 4, com os ajustes dele.
  function voltarAoUltimoTrecho() {
    editarItem(itens.length - 1);
    router.push("/novo-orcamento/step-4-precos");
  }

  if (itens.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold">5. Equipe e custos</h1>
        <p className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-700">
          Ainda não há nenhum trecho neste orçamento. Comece pelo Escopo (passo 2) e salve ao menos um trecho.
        </p>
        <button type="button" className="btn-secondary" onClick={() => router.push("/novo-orcamento/step-2-escopo")}>
          ← Ir para o Escopo
        </button>
      </div>
    );
  }

  const campo = (label: string, chave: "quantidade_alimentacao" | "km_deslocamento" | "diarias_aluguel_carro" | "noites_hospedagem" | "valor_frete", valor: number | undefined, passo?: string) => (
    <div>
      <label className="label-field">{label}</label>
      <input
        type="number"
        min={0}
        step={passo}
        className="input-field"
        value={custosOperacionais[chave] ?? 0}
        onChange={(e) => setCustosOperacionais({ [chave]: Math.max(0, Number(e.target.value) || 0) })}
      />
      <p className="mt-1 text-xs text-gray-500">{valor != null ? formatarMoeda(valor) : "—"}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">5. Equipe e custos</h1>
        <p className="text-sm text-gray-500">Valem para o orçamento inteiro — todos os trechos juntos.</p>
      </div>

      <div className="card space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">
            {itens.length} {itens.length === 1 ? "trecho" : "trechos"} neste orçamento
          </h2>
          <button type="button" className="btn-secondary" onClick={() => router.push("/novo-orcamento/step-2-escopo")}>
            + Adicionar outro trecho
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="table-header">
              <tr>
                <th className="py-2 pr-4 text-left">Trecho</th>
                <th className="py-2 pr-4 text-right">Metragem</th>
                <th className="py-2 pr-4 text-right">Trabalho</th>
                <th className="py-2 pr-4 text-right">Horas de obra</th>
                <th className="py-2 pr-4 text-right">Materiais</th>
                <th className="py-2 text-right">Execução</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {itens.map((item, index) => {
                const p = trechos[index]?.precificacao ?? item.precificacao;
                return (
                  <tr key={index}>
                    <td className="py-1.5 pr-4">
                      {index + 1} — {item.materialNome}
                    </td>
                    <td className="py-1.5 pr-4 text-right text-gray-500">{formatarNumero(p.metragem_m2, 2)} m²</td>
                    <td className="py-1.5 pr-4 text-right text-gray-500">{formatarNumero(p.m2_equivalente_mao_obra ?? 0, 2)} m² eq.</td>
                    <td className="py-1.5 pr-4 text-right text-gray-500">{formatarNumero(p.horas_mao_obra, 1)} h</td>
                    <td className="py-1.5 pr-4 text-right">{formatarMoeda(p.subtotal_material)}</td>
                    <td className="py-1.5 text-right">{formatarMoeda(p.subtotal_mao_obra)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500">"Execução" de cada trecho = a parte dele na mão de obra da equipe + os itens adicionais de execução dele.</p>
      </div>

      {config && maoObra ? <EquipeMaoObra config={config} maoObra={maoObra} /> : <p className="text-sm text-gray-500">Carregando...</p>}

      <div className="card space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Custos operacionais</h2>
          <p className="text-xs text-gray-500">
            Informe só as quantidades — os valores unitários vêm de{" "}
            <a href="/config-precos" className="text-brand hover:underline">
              Configurar Preços
            </a>
            . O frete é digitado direto em R$.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {campo("Alimentação (diárias)", "quantidade_alimentacao", resultado?.valor_alimentacao)}
          {campo("Deslocamento (km)", "km_deslocamento", resultado?.valor_deslocamento)}
          {campo("Aluguel de carro (diárias)", "diarias_aluguel_carro", resultado?.valor_aluguel_carro)}
          {campo("Hospedagem (noites)", "noites_hospedagem", resultado?.valor_hospedagem)}
          {campo("Frete (R$)", "valor_frete", resultado?.valor_frete, "0.01")}
        </div>
        {maoObra && maoObra.pessoas > 0 && maoObra.dias > 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg bg-brand-light/40 px-4 py-2 text-sm text-brand">
            <span>
              Equipe de {maoObra.pessoas} {maoObra.pessoas === 1 ? "pessoa" : "pessoas"} × {maoObra.dias} {maoObra.dias === 1 ? "dia" : "dias"} de obra ={" "}
              <strong>{maoObra.pessoas * maoObra.dias} diárias de alimentação</strong>.
            </span>
            {custosOperacionais.quantidade_alimentacao !== maoObra.pessoas * maoObra.dias && (
              <button type="button" className="font-medium hover:underline" onClick={() => setCustosOperacionais({ quantidade_alimentacao: maoObra.pessoas * maoObra.dias })}>
                Usar essa quantidade
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap justify-between gap-3">
        <button type="button" className="btn-secondary" onClick={voltarAoUltimoTrecho}>
          ← Voltar ao último trecho
        </button>
        <button type="button" className="btn-primary" onClick={() => router.push("/novo-orcamento/step-6-revisao")}>
          Próximo →
        </button>
      </div>
    </div>
  );
}
