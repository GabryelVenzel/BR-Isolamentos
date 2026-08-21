import { formatarData, formatarMoeda, formatarNumero } from "@/lib/format";
import type { Orcamento } from "@/lib/types";

interface Props {
  orcamento: Orcamento;
}

/**
 * Layout da proposta em HTML, capturado via html2canvas em lib/pdf-generator.ts.
 * Mantido como componente de servidor puro (sem interatividade) para que o
 * snapshot fique estável.
 */
export default function PDFPreview({ orcamento }: Props) {
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
        </div>
      </header>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-bold uppercase text-brand">Cliente</h2>
        <p className="text-sm">{orcamento.cliente?.nome}</p>
        {orcamento.cliente?.cnpj_cpf && <p className="text-sm text-gray-500">{orcamento.cliente.cnpj_cpf}</p>}
        {orcamento.cliente?.endereco && <p className="text-sm text-gray-500">{orcamento.cliente.endereco}</p>}
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-bold uppercase text-brand">Especificações técnicas</h2>
        <table className="w-full text-sm">
          <tbody>
            <Row label="Tipo de trabalho" valor={orcamento.tipo_trabalho === "quente" ? "Quente" : "Frio"} />
            <Row label="Material" valor={orcamento.material} />
            {orcamento.acabamento && <Row label="Acabamento" valor={orcamento.acabamento} />}
            <Row label="Geometria" valor={orcamento.geometria === "tubulacao" ? "Tubulação" : "Superfície plana"} />
            <Row label="Área" valor={`${formatarNumero(orcamento.area_m2)} m²`} />
            <Row label="Espessura necessária" valor={`${formatarNumero(orcamento.espessura_necessaria_mm, 1)} mm`} />
          </tbody>
        </table>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-bold uppercase text-brand">Materiais</h2>
        <table className="w-full text-sm">
          <tbody>
            <Row label="Manta isolante" valor={`${formatarNumero(orcamento.manta_kg ?? 0)} kg`} />
            <Row label="Chapa de acabamento" valor={`${formatarNumero(orcamento.chapa_kg ?? 0)} kg`} />
            <Row label="Rebites" valor={`${orcamento.rebites ?? 0} un`} />
            <Row label="Parafusos" valor={`${orcamento.parafusos ?? 0} un`} />
            <Row label="Arame" valor={`${formatarNumero(orcamento.arame_kg ?? 0)} kg`} />
            <Row label="Vedação P.U." valor={`${orcamento.vedacao_pu ?? 0} un`} />
            <Row label="Vedacit" valor={`${orcamento.vedacit_un ?? 0} un`} />
          </tbody>
        </table>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-bold uppercase text-brand">Investimento</h2>
        <table className="w-full text-sm">
          <tbody>
            <Row label="Materiais" valor={formatarMoeda(orcamento.valor_materiais)} />
            <Row label="Mão de obra" valor={formatarMoeda(orcamento.valor_mao_obra)} />
            <Row label="Deslocamento" valor={formatarMoeda(orcamento.valor_deslocamento)} />
            <Row label="Hospedagem" valor={formatarMoeda(orcamento.valor_hospedagem)} />
            <Row label="Frete" valor={formatarMoeda(orcamento.valor_frete)} />
            <Row label="Impostos (ISS + INSS)" valor={formatarMoeda(orcamento.total_impostos)} />
          </tbody>
        </table>
        <div className="mt-4 rounded-lg bg-brand-light p-4 text-right">
          <p className="text-xs uppercase text-gray-500">Valor total</p>
          <p className="text-2xl font-bold text-brand">{formatarMoeda(orcamento.valor_final)}</p>
        </div>
      </section>

      {orcamento.economia_anual != null && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-bold uppercase text-brand">Retorno ambiental e financeiro</h2>
          <table className="w-full text-sm">
            <tbody>
              <Row label="Economia anual estimada" valor={formatarMoeda(orcamento.economia_anual)} />
              {orcamento.co2_ton_ano != null && (
                <Row label="CO₂ evitado por ano" valor={`${formatarNumero(orcamento.co2_ton_ano, 2)} t`} />
              )}
            </tbody>
          </table>
        </section>
      )}

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
