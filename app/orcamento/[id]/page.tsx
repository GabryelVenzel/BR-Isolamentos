import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { classesStatus, formatarData, formatarMoeda, formatarNumero, formatarStatus } from "@/lib/format";
import TableMateriais from "@/components/TableMateriais";
import CabecalhoPagina from "@/components/ui/CabecalhoPagina";
import type { Orcamento } from "@/lib/types";
import { LABEL_FUNCAO_MAO_OBRA } from "@/lib/usecases/orcamento/maoObraEquipe";

export const dynamic = "force-dynamic";

const LABEL_TIPO: Record<string, string> = { quente: "Quente", frio: "Frio", misto: "Misto (quente + frio)" };

export default async function OrcamentoDetalhePage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("orcamentos")
    .select("*, cliente:clientes(*), itens:itens_orcamento(*)")
    .eq("id", params.id)
    // Orçamento na lixeira (migração 047) conta como inexistente.
    .is("excluido_em", null)
    .maybeSingle();

  if (!data) notFound();
  const orcamento = data as Orcamento;
  const itens = (orcamento.itens ?? []).sort((a, b) => a.ordem - b.ordem);

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo={orcamento.numero}
        voltar={{ href: "/historico", label: "Histórico" }}
        descricao={
          <>
            <span className={`badge mr-2 ${classesStatus(orcamento.status)}`}>{formatarStatus(orcamento.status)}</span>
            {orcamento.cliente?.nome} · {LABEL_TIPO[orcamento.tipo_trabalho] ?? orcamento.tipo_trabalho}
          </>
        }
        acaoPrincipal={{ label: "Baixar PDF", href: `/orcamento/${orcamento.id}/download-pdf` }}
        acoes={[{ label: "Editar no assistente", href: `/orcamento/${orcamento.id}/editar` }]}
      />

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
          {item.manta_kg != null ? (
            // Orçamento anterior à migração 010 — Método Expert em kg.
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
          ) : (
            <div className="space-y-2 border-t border-gray-100 pt-3 text-sm">
              {(item.escopo_itens?.length ?? 0) > 0 && (
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase text-gray-500">Escopo</p>
                  <ul className="space-y-0.5 text-gray-600">
                    {item.escopo_itens.map((escopo) => (
                      <li key={escopo.id}>• {escopo.nome}</li>
                    ))}
                  </ul>
                </div>
              )}
              {item.preco_isolante_m2 != null && (
                <p>
                  Isolante: {formatarNumero(item.area_m2)} m² × {formatarMoeda(item.preco_isolante_m2)}/m²
                </p>
              )}
              {item.preco_acabamento_m2 != null && (
                <p>
                  Acabamento: {formatarNumero(item.area_m2)} m² × {formatarMoeda(item.preco_acabamento_m2)}/m²
                </p>
              )}
              {item.horas_mao_obra > 0 && (
                <p>
                  Mão de obra: {formatarNumero(item.horas_mao_obra, 1)} h{orcamento.mao_obra_equipe ? " de obra da equipe" : ""}
                </p>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Equipe e diárias (migração 048) — só em orçamentos criados depois dela. */}
      {orcamento.mao_obra_equipe && (
        <div className="card space-y-1 text-sm">
          <h2 className="mb-2 text-lg font-semibold">Mão de obra — equipe e diárias</h2>
          {orcamento.mao_obra_equipe.funcoes.map((f) => (
            <p key={f.funcao}>
              {LABEL_FUNCAO_MAO_OBRA[f.funcao]}: {f.pessoas} × {f.diarias} {f.diarias === 1 ? "diária" : "diárias"} × {formatarMoeda(f.valor_diaria)} ={" "}
              {formatarMoeda(f.subtotal)}
            </p>
          ))}
          <p className="border-t border-gray-100 pt-1 text-gray-500">
            {formatarNumero(orcamento.mao_obra_equipe.horas_obra, 1)} h de obra ÷ {formatarNumero(orcamento.mao_obra_equipe.horas_uteis_dia, 1)} h úteis por dia ={" "}
            {orcamento.mao_obra_equipe.dias} {orcamento.mao_obra_equipe.dias === 1 ? "dia" : "dias"} de obra
            {orcamento.mao_obra_equipe.dias_manual ? " (ajuste manual)" : ""} · equipe: {formatarMoeda(orcamento.mao_obra_equipe.valor_total)}
          </p>
        </div>
      )}

      <div className="card space-y-1 text-sm">
        <h2 className="mb-2 text-lg font-semibold">Financeiro</h2>
        <p>Materiais: {formatarMoeda(orcamento.valor_materiais)}</p>
        <p>Execução: {formatarMoeda(orcamento.valor_mao_obra)}</p>
        <p>Deslocamento: {formatarMoeda(orcamento.valor_deslocamento)}</p>
        <p>Hospedagem: {formatarMoeda(orcamento.valor_hospedagem)}</p>
        <p>Frete: {formatarMoeda(orcamento.valor_frete)}</p>
        <p>Aluguel de carro: {formatarMoeda(orcamento.valor_aluguel_carro)}</p>
        <p>Alimentação: {formatarMoeda(orcamento.valor_alimentacao)}</p>
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
