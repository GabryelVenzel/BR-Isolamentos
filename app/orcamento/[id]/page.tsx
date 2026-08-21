import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { classesStatus, formatarData, formatarMoeda, formatarNumero, formatarStatus } from "@/lib/format";
import TableMateriais from "@/components/TableMateriais";
import type { Orcamento } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function OrcamentoDetalhePage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("orcamentos")
    .select("*, cliente:clientes(*)")
    .eq("id", params.id)
    .maybeSingle();

  if (!data) notFound();
  const orcamento = data as Orcamento;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{orcamento.numero}</h1>
          <p className="text-sm text-gray-500">{orcamento.cliente?.nome}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${classesStatus(orcamento.status)}`}>
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card space-y-1 text-sm">
          <h2 className="mb-2 text-lg font-semibold">Especificações</h2>
          <p>Tipo: {orcamento.tipo_trabalho === "quente" ? "Quente" : "Frio"}</p>
          <p>Material: {orcamento.material}</p>
          {orcamento.acabamento && <p>Acabamento: {orcamento.acabamento}</p>}
          <p>Geometria: {orcamento.geometria === "tubulacao" ? "Tubulação" : "Superfície plana"}</p>
          {orcamento.diametro_mm && <p>Diâmetro: {orcamento.diametro_mm} mm</p>}
          <p>Área: {formatarNumero(orcamento.area_m2)} m²</p>
          <p>Espessura necessária: {formatarNumero(orcamento.espessura_necessaria_mm, 1)} mm</p>
          {orcamento.temperatura_face_fria != null && (
            <p>Temperatura de face fria: {formatarNumero(orcamento.temperatura_face_fria, 1)} °C</p>
          )}
        </div>

        <div className="card space-y-1 text-sm">
          <h2 className="mb-2 text-lg font-semibold">Financeiro</h2>
          <p>Materiais: {formatarMoeda(orcamento.valor_materiais)}</p>
          <p>Mão de obra: {formatarMoeda(orcamento.valor_mao_obra)}</p>
          <p>Deslocamento: {formatarMoeda(orcamento.valor_deslocamento)}</p>
          <p>Hospedagem: {formatarMoeda(orcamento.valor_hospedagem)}</p>
          <p>Frete: {formatarMoeda(orcamento.valor_frete)}</p>
          <p>Impostos: {formatarMoeda(orcamento.total_impostos)}</p>
          <p>Margem de lucro: {formatarMoeda(orcamento.margem_lucro)}</p>
          <p>Desconto: -{formatarMoeda(orcamento.valor_desconto)}</p>
          <p className="border-t border-gray-100 pt-2 text-lg font-bold text-accent">
            Valor final: {formatarMoeda(orcamento.valor_final)}
          </p>
        </div>
      </div>

      {orcamento.manta_kg != null && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Materiais</h2>
          <TableMateriais
            quantificacao={{
              manta_kg: orcamento.manta_kg ?? 0,
              chapa_kg: orcamento.chapa_kg ?? 0,
              rebites: orcamento.rebites ?? 0,
              parafusos: orcamento.parafusos ?? 0,
              arame_kg: orcamento.arame_kg ?? 0,
              vedacao_pu: orcamento.vedacao_pu ?? 0,
              vedacit_un: orcamento.vedacit_un ?? 0,
            }}
          />
        </div>
      )}

      <p className="text-xs text-gray-400">
        Criado em {formatarData(orcamento.criado_em)} por {orcamento.criado_por ?? "—"} · Última atualização em{" "}
        {formatarData(orcamento.atualizado_em)}
      </p>
    </div>
  );
}
