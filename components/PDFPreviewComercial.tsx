import { formatarData, formatarMoeda, formatarNumero } from "@/lib/format";
import type { Orcamento } from "@/lib/types";

interface Props {
  orcamento: Orcamento;
}

const LABEL_TIPO: Record<string, string> = { quente: "Quente", frio: "Frio", misto: "Misto (quente + frio)" };

/**
 * Proposta comercial (com valores) — layout em HTML capturado via html2canvas em
 * lib/pdf-generator.ts. Mantido como componente puro (sem interatividade) para que o
 * snapshot fique estável.
 */
export default function PDFPreviewComercial({ orcamento }: Props) {
  const itens = [...(orcamento.itens ?? [])].sort((a, b) => a.ordem - b.ordem);

  return (
    <div className="mx-auto w-[210mm] bg-white p-10 text-gray-900" style={{ fontFamily: "Arial, sans-serif" }}>
      <header className="mb-8 flex items-center justify-between border-b-2 border-brand pb-4">
        <div>
          <h1 className="text-2xl font-bold text-brand">BR Isolamentos</h1>
          <p className="text-sm text-gray-500">Proposta comercial de isolamento térmico</p>
        </div>
        <div className="text-right text-sm text-gray-500">
          <p>Nº {orcamento.numero}</p>
          <p>{formatarData(orcamento.data_criacao)}</p>
          <p>{LABEL_TIPO[orcamento.tipo_trabalho] ?? orcamento.tipo_trabalho}</p>
        </div>
      </header>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-bold uppercase text-brand">Cliente</h2>
        <p className="text-sm">{orcamento.cliente?.nome}</p>
        {orcamento.cliente?.cnpj_cpf && <p className="text-sm text-gray-500">{orcamento.cliente.cnpj_cpf}</p>}
        {orcamento.cliente?.endereco && <p className="text-sm text-gray-500">{orcamento.cliente.endereco}</p>}
      </section>

      {itens.map((item, index) => (
        <section key={item.id} className="mb-6 break-inside-avoid">
          <h2 className="mb-2 text-sm font-bold uppercase text-brand">
            Trecho {index + 1} — {LABEL_TIPO[item.tipo_trabalho] ?? item.tipo_trabalho}
          </h2>
          <table className="w-full text-sm">
            <tbody>
              <Row label="Material" valor={item.material} />
              {item.acabamento && <Row label="Acabamento" valor={item.acabamento} />}
              <Row label="Geometria" valor={item.geometria === "tubulacao" ? "Tubulação" : "Superfície plana"} />
              <Row label="Área" valor={`${formatarNumero(item.area_m2)} m²`} />
              <Row label="Espessura necessária" valor={`${formatarNumero(item.espessura_necessaria_mm, 1)} mm`} />
              <Row label="Manta isolante" valor={`${formatarNumero(item.manta_kg ?? 0)} kg`} />
              <Row label="Chapa de acabamento" valor={`${formatarNumero(item.chapa_kg ?? 0)} kg`} />
              <Row label="Rebites / Parafusos" valor={`${item.rebites ?? 0} / ${item.parafusos ?? 0} un`} />
              <Row label="Arame" valor={`${formatarNumero(item.arame_kg ?? 0)} kg`} />
              <Row label="Vedação P.U. / Vedacit" valor={`${item.vedacao_pu ?? 0} un / ${item.vedacit_un ?? 0} un`} />
              <Row label="Custo de materiais" valor={formatarMoeda(item.valor_materiais)} />
            </tbody>
          </table>
        </section>
      ))}

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-bold uppercase text-brand">Investimento</h2>
        <table className="w-full text-sm">
          <tbody>
            <Row label="Materiais" valor={formatarMoeda(orcamento.valor_materiais)} />
            <Row label="Mão de obra" valor={formatarMoeda(orcamento.valor_mao_obra)} />
            <Row label="Deslocamento" valor={formatarMoeda(orcamento.valor_deslocamento)} />
            <Row label="Hospedagem" valor={formatarMoeda(orcamento.valor_hospedagem)} />
            <Row label="Frete" valor={formatarMoeda(orcamento.valor_frete)} />
            {(orcamento.detalhamento_impostos ?? []).map((imposto) => (
              <Row key={imposto.nome} label={`${imposto.nome} (${imposto.percentual.toFixed(2)}%)`} valor={formatarMoeda(imposto.valor)} />
            ))}
            {orcamento.valor_desconto > 0 && (
              <Row label="Desconto" valor={`- ${formatarMoeda(orcamento.valor_desconto)}`} />
            )}
          </tbody>
        </table>
        <div className="mt-4 rounded-lg bg-brand-light p-4 text-right">
          <p className="text-xs uppercase text-gray-500">Valor total</p>
          <p className="text-2xl font-bold text-brand">{formatarMoeda(orcamento.valor_final)}</p>
        </div>
      </section>

      <footer className="mt-10 border-t border-gray-200 pt-4 text-xs text-gray-400">
        Cálculos realizados conforme ASTM C680 / ISO 12241, em conformidade com a ABNT NBR 16281.
      </footer>
    </div>
  );
}

function Row({ label, valor }: { label: string; valor: string }) {
  return (
    <tr className="border-b border-gray-100">
      <td className="py-1.5 text-gray-500">{label}</td>
      <td className="py-1.5 text-right font-medium">{valor}</td>
    </tr>
  );
}
