import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { classesStatus, formatarData, formatarMoeda, formatarNumero, formatarStatus } from "@/lib/format";
import TableMateriais from "@/components/TableMateriais";
import type { Orcamento } from "@/lib/types";

export const dynamic = "force-dynamic";

const LABEL_TIPO: Record<string, string> = { quente: "Quente", frio: "Frio", misto: "Misto (quente + frio)" };

export default async function OrcamentoDetalhePage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("orcamentos")
    .select("*, cliente:clientes(*), itens:itens_orcamento(*)")
    .eq("id", params.id)
    .maybeSingle();

  if (!data) notFound();
  const orcamento = data as Orcamento;
  const itens = (orcamento.itens ?? []).sort((a, b) => a.ordem - b.ordem);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{orcamento.numero}</h1>
          <p className="text-sm text-gray-500">
            {orcamento.cliente?.nome} · {LABEL_TIPO[orcamento.tipo_trabalho] ?? orcamento.tipo_trabalho}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`badge ${classesStatus(orcamento.status)}`}>
            {formatarStatus(orcamento.status)}
          </span>
          <Link href={`/orcamento/${orcamento.id}/editar`} className="btn-secondary">
            Editar
          </Link>
          <Link href={`/orcamento/${orcamento.id}/download-pdf`} className="btn-primary">
            Baixar PDF
          </Link>
        </div>
      </div>

      {itens.map((item) => (
        <div key={item.id} className="card space-y-3">
          <h2 className="text-lg font-semibold">
            {LABEL_TIPO[item.tipo_trabalho] ?? item.tipo_trabalho} — {item.material}
          </h2>
          <div className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
            {item.acabamento && <p>Acabamento: {item.acabamento}</p>}
            <p>Geometria: {item.geometria === "tubulacao" ? "Tubulação" : "Superfície plana"}</p>
            {item.diametro_mm && <p>Diâmetro: {item.diametro_mm} mm</p>}
            <p>Área: {formatarNumero(item.area_m2)} m²</p>
            <p>Espessura necessária: {formatarNumero(item.espessura_necessaria_mm, 1)} mm</p>
            {item.temperatura_face_fria != null && (
              <p>Temperatura de face fria: {formatarNumero(item.temperatura_face_fria, 1)} °C</p>
            )}
            {item.economia_anual != null && <p>Economia anual estimada: {formatarMoeda(item.economia_anual)}</p>}
            {item.co2_ton_ano != null && <p>CO₂ evitado/ano: {formatarNumero(item.co2_ton_ano, 2)} t</p>}
            <p>Custo de materiais: {formatarMoeda(item.valor_materiais)}</p>
          </div>
          <TableMateriais
            quantificacao={{
              manta_kg: item.manta_kg ?? 0,
              chapa_kg: item.chapa_kg ?? 0,
              rebites: item.rebites ?? 0,
              parafusos: item.parafusos ?? 0,
              arame_kg: item.arame_kg ?? 0,
              vedacao_pu: item.vedacao_pu ?? 0,
              vedacit_un: item.vedacit_un ?? 0,
            }}
          />
        </div>
      ))}

      <div className="card space-y-1 text-sm">
        <h2 className="mb-2 text-lg font-semibold">Financeiro</h2>
        <p>Materiais: {formatarMoeda(orcamento.valor_materiais)}</p>
        <p>Mão de obra: {formatarMoeda(orcamento.valor_mao_obra)}</p>
        <p>Deslocamento: {formatarMoeda(orcamento.valor_deslocamento)}</p>
        <p>Hospedagem: {formatarMoeda(orcamento.valor_hospedagem)}</p>
        <p>Frete: {formatarMoeda(orcamento.valor_frete)}</p>
        <p className="border-t border-gray-100 pt-1">Custo total: {formatarMoeda(orcamento.subtotal)}</p>
        {(orcamento.detalhamento_impostos ?? []).map((imposto) => (
          <p key={imposto.nome}>
            {imposto.nome} ({imposto.percentual.toFixed(2)}%): {formatarMoeda(imposto.valor)}
          </p>
        ))}
        <p>Margem de lucro: {formatarMoeda(orcamento.margem_lucro)}</p>
        <p>Preço cheio: {formatarMoeda(orcamento.preco_cheio)}</p>
        <p>Desconto: -{formatarMoeda(orcamento.valor_desconto)}</p>
        <p className="border-t border-gray-100 pt-2 text-lg font-bold text-accent">
          Valor final: {formatarMoeda(orcamento.valor_final)}
        </p>
      </div>

      <p className="text-xs text-gray-400">
        Criado em {formatarData(orcamento.criado_em)} por {orcamento.criado_por ?? "—"} · Última atualização em{" "}
        {formatarData(orcamento.atualizado_em)}
      </p>
    </div>
  );
}
