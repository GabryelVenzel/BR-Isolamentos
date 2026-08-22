"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { tipoTrabalhoAgregado, useWizardStore } from "@/lib/store";
import { formatarMoeda } from "@/lib/format";
import TableMateriais from "@/components/TableMateriais";
import type { ItemOrcamento, Orcamento } from "@/lib/types";

export default function Step5RevisaoPage() {
  const router = useRouter();
  const { clienteSelecionado, itens, resultadoOrcamento, reset } = useWizardStore();

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const tipoTrabalho = itens.length > 0 ? tipoTrabalhoAgregado(itens) : null;
  const completo = clienteSelecionado && itens.length > 0 && resultadoOrcamento;

  async function salvar(status: Orcamento["status"]) {
    if (!completo || !tipoTrabalho) return;
    setErro(null);
    setSalvando(true);

    try {
      const itensPayload: Array<Omit<ItemOrcamento, "id" | "orcamento_id">> = itens.map((item, index) => {
        const espessuraNecessaria =
          item.especificacoes.tipo_trabalho === "quente"
            ? item.especificacoes.espessuras_mm.reduce((a, b) => a + b, 0)
            : item.resultadoTermicoFrio?.espessura_minima_mm ?? 0;

        return {
          ordem: index,
          tipo_trabalho: item.especificacoes.tipo_trabalho,
          material: item.materialNome,
          acabamento: item.acabamentoNome,
          temperatura_quente: item.especificacoes.temperatura_quente,
          temperatura_ambiente: item.especificacoes.temperatura_ambiente,
          umidade_relativa: item.especificacoes.umidade_relativa,
          velocidade_vento: item.especificacoes.velocidade_vento_ms,
          geometria: item.especificacoes.geometria,
          diametro_mm: item.especificacoes.diametro_mm,
          area_m2: item.especificacoes.area_m2,
          perimetro_m: item.especificacoes.perimetro_m,

          espessura_necessaria_mm: espessuraNecessaria,
          temperatura_face_fria: item.resultadoTermicoQuente?.temperatura_face_fria ?? null,
          perda_com_isolante: item.resultadoTermicoQuente?.perda_com_isolante_kw_m2 ?? 0,
          perda_sem_isolante: item.resultadoTermicoQuente?.perda_sem_isolante_kw_m2 ?? 0,
          economia_anual: item.resultadoTermicoQuente?.financeiro?.economia_anual ?? null,
          co2_ton_ano: item.resultadoTermicoQuente?.financeiro?.co2_ton_ano ?? null,

          manta_kg: item.quantificacao.manta_kg,
          chapa_kg: item.quantificacao.chapa_kg,
          rebites: item.quantificacao.rebites,
          parafusos: item.quantificacao.parafusos,
          arame_kg: item.quantificacao.arame_kg,
          vedacao_pu: item.quantificacao.vedacao_pu,
          vedacit_un: item.quantificacao.vedacit_un,

          valor_materiais: item.valorMateriais,
        };
      });

      const payload = {
        cliente_id: clienteSelecionado!.id,
        tipo_trabalho: tipoTrabalho,

        valor_materiais: resultadoOrcamento!.valor_materiais,
        valor_mao_obra: resultadoOrcamento!.valor_mao_obra,
        valor_deslocamento: resultadoOrcamento!.valor_deslocamento,
        valor_hospedagem: resultadoOrcamento!.valor_hospedagem,
        valor_frete: resultadoOrcamento!.valor_frete,
        subtotal: resultadoOrcamento!.subtotal,
        detalhamento_impostos: resultadoOrcamento!.detalhamento_impostos,
        total_impostos: resultadoOrcamento!.total_impostos,
        margem_lucro: resultadoOrcamento!.margem_lucro,
        valor_desconto: resultadoOrcamento!.valor_desconto,
        preco_cheio: resultadoOrcamento!.preco_cheio,
        valor_final: resultadoOrcamento!.valor_final,

        status,
        itens: itensPayload,
      };

      const response = await fetch("/api/orcamentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        setErro(data.error ?? "Erro ao salvar orçamento.");
        return;
      }

      reset();
      router.push(`/orcamento/${data.id}`);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">5. Revisão e proposta</h1>
        <p className="text-sm text-gray-500">Confira todos os dados antes de salvar o orçamento.</p>
      </div>

      <div className="card space-y-1 text-sm">
        <h2 className="mb-2 text-lg font-semibold">Cliente</h2>
        <p>{clienteSelecionado?.nome ?? "—"}</p>
      </div>

      {tipoTrabalho && (
        <div className="rounded-lg bg-brand-light px-4 py-2 text-sm text-brand">
          Tipo de orçamento: <strong>{tipoTrabalho === "misto" ? "Misto (quente + frio)" : tipoTrabalho === "quente" ? "Quente" : "Frio"}</strong>
        </div>
      )}

      {itens.map((item, index) => {
        const espessuraNecessaria =
          item.especificacoes.tipo_trabalho === "quente"
            ? item.especificacoes.espessuras_mm.reduce((a, b) => a + b, 0)
            : item.resultadoTermicoFrio?.espessura_minima_mm ?? 0;

        return (
          <div key={index} className="card space-y-3">
            <h2 className="text-lg font-semibold">
              Trecho {index + 1} — {item.especificacoes.tipo_trabalho === "quente" ? "Quente" : "Frio"}
            </h2>
            <div className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
              <p>Material: {item.materialNome}</p>
              {item.acabamentoNome && <p>Acabamento: {item.acabamentoNome}</p>}
              <p>Geometria: {item.especificacoes.geometria === "tubulacao" ? "Tubulação" : "Superfície plana"}</p>
              <p>Área: {item.especificacoes.area_m2} m²</p>
              <p>Espessura necessária: {espessuraNecessaria.toFixed(1)} mm</p>
              <p>Custo de materiais: {formatarMoeda(item.valorMateriais)}</p>
            </div>
            <TableMateriais quantificacao={item.quantificacao} />
          </div>
        );
      })}

      {resultadoOrcamento && (
        <div className="card">
          <h2 className="mb-2 text-lg font-semibold">Valor final</h2>
          <p className="text-3xl font-bold text-accent">{formatarMoeda(resultadoOrcamento.valor_final)}</p>
        </div>
      )}

      {!completo && (
        <p className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-700">
          Complete os passos anteriores antes de salvar o orçamento.
        </p>
      )}
      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <div className="flex flex-wrap justify-between gap-3">
        <button type="button" className="btn-secondary" onClick={() => router.push("/novo-orcamento/step-4-precos")}>
          ← Voltar
        </button>
        <div className="flex gap-3">
          <button type="button" className="btn-accent" disabled={!completo || salvando} onClick={() => salvar("rascunho")}>
            Salvar rascunho
          </button>
          <button type="button" className="btn-primary" disabled={!completo || salvando} onClick={() => salvar("proposta")}>
            {salvando ? "Salvando..." : "Gerar proposta"}
          </button>
        </div>
      </div>
    </div>
  );
}
