import { formatarMoeda, formatarNumero } from "@/lib/format";
import PdfFooter from "@/components/pdf/PdfFooter";
import PdfHeader from "@/components/pdf/PdfHeader";
import type { ConfigEmpresa, Orcamento } from "@/lib/types";

interface Props {
  orcamento: Orcamento;
  configEmpresa?: ConfigEmpresa | null;
}

const LABEL_TIPO: Record<string, string> = { quente: "Quente", frio: "Frio", misto: "Misto (quente + frio)" };

/**
 * Proposta comercial (com valores) — layout em HTML capturado via html2canvas em
 * lib/pdf-generator.ts. Mantido como componente puro (sem interatividade) para que o
 * snapshot fique estável. Estrutura/cores seguem o Brand Book (ver
 * 1-IdentidadeVisual/) — qualquer alteração de layout deve preservar o
 * cabeçalho/rodapé com a marca e o total em destaque verde.
 */
export default function PDFPreviewComercial({ orcamento, configEmpresa }: Props) {
  const itens = [...(orcamento.itens ?? [])].sort((a, b) => a.ordem - b.ordem);

  // Um orçamento é inteiramente de um "regime" ou outro — Método Expert em kg
  // (anterior à migração 010) ou preço por m² (atual). Não mistura os dois no
  // mesmo orçamento, então basta checar o primeiro item pra decidir qual
  // detalhamento mostrar.
  const ehLegado = itens.length > 0 && itens[0].manta_kg != null;

  // Quantificação agregada de todos os trechos (Método Expert, kg) — só pra
  // orçamentos anteriores à migração 010. Não há preço unitário por material
  // persistido no orçamento (só o custo total já calculado), então a tabela
  // mostra quantidade + o custo total de materiais uma única vez no rodapé.
  const quantificacao = itens.reduce(
    (acc, item) => ({
      manta_kg: acc.manta_kg + (item.manta_kg ?? 0),
      chapa_kg: acc.chapa_kg + (item.chapa_kg ?? 0),
      rebites: acc.rebites + (item.rebites ?? 0),
      parafusos: acc.parafusos + (item.parafusos ?? 0),
      arame_kg: acc.arame_kg + (item.arame_kg ?? 0),
      vedacao_pu: acc.vedacao_pu + (item.vedacao_pu ?? 0),
      vedacit_un: acc.vedacit_un + (item.vedacit_un ?? 0),
    }),
    { manta_kg: 0, chapa_kg: 0, rebites: 0, parafusos: 0, arame_kg: 0, vedacao_pu: 0, vedacit_un: 0 }
  );

  const linhasQuantificacao = [
    { material: "Manta isolante", quantidade: quantificacao.manta_kg, unidade: "kg" },
    { material: "Chapa de acabamento", quantidade: quantificacao.chapa_kg, unidade: "kg" },
    { material: "Rebites", quantidade: quantificacao.rebites, unidade: "un" },
    { material: "Parafusos", quantidade: quantificacao.parafusos, unidade: "un" },
    { material: "Arame", quantidade: quantificacao.arame_kg, unidade: "kg" },
    { material: "Vedação P.U.", quantidade: quantificacao.vedacao_pu, unidade: "un" },
    { material: "Vedacit", quantidade: quantificacao.vedacit_un, unidade: "un" },
  ].filter((linha) => linha.quantidade > 0);

  // Divisão Material / Mão de obra "com a mesma margem de lucro" (pedido
  // original) — Material inclui isolante + acabamento de todos os trechos;
  // Mão de obra é o total já calculado no orçamento (valor_mao_obra). Ambos
  // dividem a MESMA margem/impostos do cálculo completo (não uma margem fixa
  // separada) — por isso a soma dos dois blocos abaixo bate exatamente com
  // "Subtotal (materiais + serviços)" da seção de Resumo Financeiro.
  const totalHoras = itens.reduce((acc, i) => acc + (i.horas_mao_obra ?? 0), 0);

  const temCustosOperacionais =
    orcamento.valor_mao_obra > 0 ||
    orcamento.valor_deslocamento > 0 ||
    orcamento.valor_hospedagem > 0 ||
    orcamento.valor_frete > 0;

  const beneficios = itens.filter((i) => i.economia_anual != null || i.co2_ton_ano != null);
  const economiaAnualTotal = beneficios.reduce((acc, i) => acc + (i.economia_anual ?? 0), 0);
  const co2TotalAno = beneficios.reduce((acc, i) => acc + (i.co2_ton_ano ?? 0), 0);

  return (
    <div
      className="mx-auto w-[210mm] bg-white p-10 text-gray-800"
      style={{ fontFamily: "'Alfaim 2', -apple-system, 'Segoe UI', Arial, sans-serif" }}
    >
      <PdfHeader
        titulo="PROPOSTA DE ORÇAMENTO"
        numero={orcamento.numero}
        data={orcamento.data_criacao}
        tipoTrabalho={LABEL_TIPO[orcamento.tipo_trabalho] ?? orcamento.tipo_trabalho}
      />

      <section className="mb-6 rounded-card bg-brand-light/60 p-4">
        <h2 className="mb-2 font-montserrat text-sm font-bold uppercase text-brand">Cliente</h2>
        <p className="text-sm font-semibold text-gray-800">{orcamento.cliente?.nome}</p>
        {orcamento.cliente?.cnpj_cpf && <p className="text-sm text-gray-600">{orcamento.cliente.cnpj_cpf}</p>}
        {orcamento.cliente?.endereco && <p className="text-sm text-gray-600">{orcamento.cliente.endereco}</p>}
        <p className="text-sm text-gray-600">
          {[orcamento.cliente?.telefone, orcamento.cliente?.email].filter(Boolean).join("  ·  ")}
        </p>
      </section>

      <section className="mb-6 break-inside-avoid">
        <h2 className="mb-2 font-montserrat text-sm font-bold uppercase text-brand">Especificações Técnicas</h2>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-brand-light text-left font-montserrat font-bold uppercase text-brand">
              <Th>Trecho</Th>
              <Th>Material</Th>
              <Th>Tipo</Th>
              <Th>Geometria</Th>
              <Th>Área</Th>
              <Th>Espessura</Th>
            </tr>
          </thead>
          <tbody>
            {itens.map((item, index) => (
              <tr key={item.id} className="border-b border-gray-200">
                <Td>
                  {index + 1}
                  {item.acabamento ? ` (${item.acabamento})` : ""}
                </Td>
                <Td>{item.material}</Td>
                <Td>{LABEL_TIPO[item.tipo_trabalho] ?? item.tipo_trabalho}</Td>
                <Td>{item.geometria === "tubulacao" ? "Tubulação" : "Superfície plana"}</Td>
                <Td>{formatarNumero(item.area_m2)} m²</Td>
                <Td>{formatarNumero(item.espessura_necessaria_mm, 1)} mm</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {ehLegado && linhasQuantificacao.length > 0 && (
        <section className="mb-6 break-inside-avoid">
          <h2 className="mb-2 font-montserrat text-sm font-bold uppercase text-brand">Quantificação de Materiais</h2>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-accent text-left font-montserrat font-bold uppercase text-white">
                <Th light>Material</Th>
                <Th light align="right">
                  Quantidade
                </Th>
                <Th light>Unidade</Th>
              </tr>
            </thead>
            <tbody>
              {linhasQuantificacao.map((linha) => (
                <tr key={linha.material} className="border-b border-gray-200 even:bg-gray-50">
                  <Td>{linha.material}</Td>
                  <Td align="right">{formatarNumero(linha.quantidade, linha.unidade === "un" ? 0 : 2)}</Td>
                  <Td>{linha.unidade}</Td>
                </tr>
              ))}
              <tr className="bg-gray-100 font-semibold">
                <Td colSpan={2} align="right">
                  Custo total de materiais
                </Td>
                <Td>{formatarMoeda(orcamento.valor_materiais)}</Td>
              </tr>
            </tbody>
          </table>
        </section>
      )}

      {!ehLegado && itens.length > 0 && (
        <section className="mb-6 break-inside-avoid">
          <h2 className="mb-2 font-montserrat text-sm font-bold uppercase text-brand">Materiais por Trecho (R$/m²)</h2>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-accent text-left font-montserrat font-bold uppercase text-white">
                <Th light>Trecho</Th>
                <Th light>Isolante</Th>
                <Th light>Acabamento</Th>
                <Th light align="right">
                  Metragem
                </Th>
                <Th light align="right">
                  Mão de obra
                </Th>
              </tr>
            </thead>
            <tbody>
              {itens.map((item, index) => (
                <tr key={item.id} className="border-b border-gray-200 even:bg-gray-50">
                  <Td>{index + 1}</Td>
                  <Td>{item.material}</Td>
                  <Td>{item.acabamento ?? "—"}</Td>
                  <Td align="right">{formatarNumero(item.area_m2)} m²</Td>
                  <Td align="right">{formatarNumero(item.horas_mao_obra ?? 0, 1)}h</Td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Transparência limitada, conforme o pedido: divide-se em Material e Mão de
              Obra, ambos com a mesma margem de lucro do cálculo completo — não uma
              margem fixa separada por bloco. */}
          <p className="mb-2 mt-4 text-xs text-gray-500">
            O valor apresentado divide-se em Material e Mão de Obra, ambos com a mesma margem de lucro,
            conforme segue:
          </p>
          <table className="w-full text-sm">
            <tbody>
              <Row label="Material (isolante + acabamentos)" valor={formatarMoeda(orcamento.valor_materiais)} />
              <Row
                label={`Mão de obra (${formatarNumero(totalHoras, 1)}h)`}
                valor={formatarMoeda(orcamento.valor_mao_obra)}
              />
            </tbody>
          </table>
        </section>
      )}

      {temCustosOperacionais && (
        <section className="mb-6 break-inside-avoid">
          <h2 className="mb-2 font-montserrat text-sm font-bold uppercase text-brand">Custos Operacionais</h2>
          <table className="w-full text-sm">
            <tbody>
              {orcamento.valor_mao_obra > 0 && <Row label="Mão de obra" valor={formatarMoeda(orcamento.valor_mao_obra)} />}
              {orcamento.valor_deslocamento > 0 && (
                <Row label="Deslocamento" valor={formatarMoeda(orcamento.valor_deslocamento)} />
              )}
              {orcamento.valor_hospedagem > 0 && (
                <Row label="Hospedagem" valor={formatarMoeda(orcamento.valor_hospedagem)} />
              )}
              {orcamento.valor_frete > 0 && <Row label="Frete" valor={formatarMoeda(orcamento.valor_frete)} />}
            </tbody>
          </table>
        </section>
      )}

      <section className="mb-6 break-inside-avoid rounded-card bg-brand-light/60 p-5">
        <h2 className="mb-2 font-montserrat text-sm font-bold uppercase text-brand">Resumo Financeiro</h2>
        <table className="w-full text-sm">
          <tbody>
            <Row label="Subtotal (materiais + serviços)" valor={formatarMoeda(orcamento.subtotal)} />
            {(orcamento.detalhamento_impostos ?? []).map((imposto) => (
              <Row
                key={imposto.nome}
                label={`(+) ${imposto.nome} (${imposto.percentual.toFixed(2)}%)`}
                valor={formatarMoeda(imposto.valor)}
              />
            ))}
            <Row label="(+) Margem de lucro" valor={formatarMoeda(orcamento.margem_lucro)} />
            {orcamento.valor_desconto > 0 && (
              <Row label="(-) Desconto comercial" valor={`- ${formatarMoeda(orcamento.valor_desconto)}`} />
            )}
          </tbody>
        </table>
        <div className="divider-brand" />
        <div className="flex items-baseline justify-between">
          <p className="font-montserrat text-sm font-bold uppercase text-brand">Valor Total</p>
          <p className="font-montserrat text-2xl font-bold text-accent">{formatarMoeda(orcamento.valor_final)}</p>
        </div>
      </section>

      {beneficios.length > 0 && (
        <section className="mb-6 break-inside-avoid rounded-card border-l-4 border-accent bg-accent-light/60 p-4">
          <h2 className="mb-2 font-montserrat text-xs font-bold uppercase text-brand">Benefícios da Solução</h2>
          <ul className="space-y-1 text-xs text-gray-700">
            {economiaAnualTotal > 0 && <li>• Economia anual estimada de energia: {formatarMoeda(economiaAnualTotal)}</li>}
            {co2TotalAno > 0 && <li>• Redução de emissão de CO₂: {formatarNumero(co2TotalAno, 2)} toneladas/ano</li>}
          </ul>
        </section>
      )}

      <PdfFooter
        observacao="Proposta comercial preparada especialmente para o cliente acima."
        telefoneEmpresa={configEmpresa?.telefone_empresa}
        emailEmpresa={configEmpresa?.email_empresa}
      />
    </div>
  );
}

function Row({ label, valor }: { label: string; valor: string }) {
  return (
    <tr className="border-b border-gray-200/70">
      <td className="py-1.5 text-gray-600">{label}</td>
      <td className="py-1.5 text-right font-medium text-gray-800">{valor}</td>
    </tr>
  );
}

function Th({ children, light, align }: { children: React.ReactNode; light?: boolean; align?: "left" | "right" }) {
  return (
    <th
      className={`border-b-2 px-2 py-1.5 ${light ? "border-white/30" : "border-brand/20"} ${
        align === "right" ? "text-right" : ""
      }`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align,
  colSpan,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  colSpan?: number;
}) {
  return (
    <td className={`px-2 py-1.5 ${align === "right" ? "text-right" : ""}`} colSpan={colSpan}>
      {children}
    </td>
  );
}
