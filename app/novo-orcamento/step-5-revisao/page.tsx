"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWizardStore } from "@/lib/store";
import { formatarMoeda } from "@/lib/format";
import TableMateriais from "@/components/TableMateriais";
import type { Acabamento, MaterialIsolante, Orcamento } from "@/lib/types";

export default function Step5RevisaoPage() {
  const router = useRouter();
  const {
    clienteSelecionado,
    especificacoes,
    resultadoTermicoQuente,
    resultadoTermicoFrio,
    quantificacao,
    resultadoOrcamento,
    reset,
  } = useWizardStore();

  const [materiais, setMateriais] = useState<MaterialIsolante[]>([]);
  const [acabamentos, setAcabamentos] = useState<Acabamento[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/materiais").then((r) => r.json()).then(setMateriais);
    fetch("/api/acabamentos").then((r) => r.json()).then(setAcabamentos);
  }, []);

  const material = materiais.find((m) => m.id === especificacoes.material_id);
  const acabamento = acabamentos.find((a) => a.id === especificacoes.acabamento_id);
  const espessuraNecessaria =
    especificacoes.tipo_trabalho === "quente"
      ? especificacoes.espessuras_mm.reduce((a, b) => a + b, 0)
      : resultadoTermicoFrio?.espessura_minima_mm ?? 0;

  const completo = clienteSelecionado && material && quantificacao && resultadoOrcamento;

  async function salvar(status: Orcamento["status"]) {
    if (!completo) return;
    setErro(null);
    setSalvando(true);

    try {
      const payload: Partial<Orcamento> = {
        cliente_id: clienteSelecionado!.id,
        tipo_trabalho: especificacoes.tipo_trabalho,
        material: material!.nome,
        acabamento: acabamento?.nome ?? null,
        temperatura_quente: especificacoes.temperatura_quente,
        temperatura_ambiente: especificacoes.temperatura_ambiente,
        umidade_relativa: especificacoes.umidade_relativa,
        velocidade_vento: especificacoes.velocidade_vento_ms,
        geometria: especificacoes.geometria,
        diametro_mm: especificacoes.diametro_mm,
        area_m2: especificacoes.area_m2,
        perimetro_m: especificacoes.perimetro_m,

        espessura_necessaria_mm: espessuraNecessaria,
        temperatura_face_fria: resultadoTermicoQuente?.temperatura_face_fria ?? null,
        perda_com_isolante: resultadoTermicoQuente?.perda_com_isolante_kw_m2 ?? 0,
        perda_sem_isolante: resultadoTermicoQuente?.perda_sem_isolante_kw_m2 ?? 0,
        economia_anual: resultadoTermicoQuente?.financeiro?.economia_anual ?? null,
        co2_ton_ano: resultadoTermicoQuente?.financeiro?.co2_ton_ano ?? null,

        manta_kg: quantificacao!.manta_kg,
        chapa_kg: quantificacao!.chapa_kg,
        rebites: quantificacao!.rebites,
        parafusos: quantificacao!.parafusos,
        arame_kg: quantificacao!.arame_kg,
        vedacao_pu: quantificacao!.vedacao_pu,
        vedacit_un: quantificacao!.vedacit_un,

        valor_materiais: resultadoOrcamento!.valor_materiais,
        valor_mao_obra: resultadoOrcamento!.valor_mao_obra,
        valor_deslocamento: resultadoOrcamento!.valor_deslocamento,
        valor_hospedagem: resultadoOrcamento!.valor_hospedagem,
        valor_frete: resultadoOrcamento!.valor_frete,
        subtotal: resultadoOrcamento!.subtotal,
        valor_iss: resultadoOrcamento!.valor_iss,
        valor_inss: resultadoOrcamento!.valor_inss,
        total_impostos: resultadoOrcamento!.total_impostos,
        margem_lucro: resultadoOrcamento!.margem_lucro,
        valor_desconto: resultadoOrcamento!.valor_desconto,
        valor_final: resultadoOrcamento!.valor_final,

        status,
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

      <div className="card space-y-1 text-sm">
        <h2 className="mb-2 text-lg font-semibold">Especificações</h2>
        <p>Tipo: {especificacoes.tipo_trabalho === "quente" ? "Quente" : "Frio"}</p>
        <p>Material: {material?.nome ?? "—"}</p>
        {acabamento && <p>Acabamento: {acabamento.nome}</p>}
        <p>Geometria: {especificacoes.geometria === "tubulacao" ? "Tubulação" : "Superfície plana"}</p>
        <p>Área: {especificacoes.area_m2} m²</p>
        <p>Espessura necessária: {espessuraNecessaria.toFixed(1)} mm</p>
      </div>

      {quantificacao && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Materiais</h2>
          <TableMateriais quantificacao={quantificacao} />
        </div>
      )}

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
          <button type="button" className="btn-secondary" disabled={!completo || salvando} onClick={() => salvar("rascunho")}>
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
