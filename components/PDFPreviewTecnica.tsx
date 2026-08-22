import { formatarMoeda, formatarNumero } from "@/lib/format";
import PdfFooter from "@/components/pdf/PdfFooter";
import PdfHeader from "@/components/pdf/PdfHeader";
import type { ConfigEmpresa, Orcamento } from "@/lib/types";

interface ImagemProposta {
  url: string;
  legenda: string | null;
}

interface Props {
  orcamento: Orcamento;
  imagens?: ImagemProposta[];
  configEmpresa?: ConfigEmpresa | null;
}

const LABEL_TIPO: Record<string, string> = { quente: "Quente", frio: "Frio", misto: "Misto (quente + frio)" };

/**
 * Proposta técnica — texto longo/conceitual, sem valores, explicando os princípios
 * físicos e os benefícios de cada item do orçamento. Adapta o conteúdo conforme o
 * orçamento seja quente, frio ou misto. Layout em HTML capturado via html2canvas
 * (lib/pdf-generator.ts). Cores/tipografia seguem o Brand Book (1-IdentidadeVisual/).
 */
export default function PDFPreviewTecnica({ orcamento, imagens = [], configEmpresa }: Props) {
  const itens = [...(orcamento.itens ?? [])].sort((a, b) => a.ordem - b.ordem);
  const itensQuentes = itens.filter((i) => i.tipo_trabalho === "quente");
  const itensFrios = itens.filter((i) => i.tipo_trabalho === "frio");
  const temQuente = itensQuentes.length > 0;
  const temFrio = itensFrios.length > 0;

  return (
    <div
      className="mx-auto w-[210mm] bg-white p-10 text-gray-800"
      style={{ fontFamily: "'Alfaim 2', -apple-system, 'Segoe UI', Arial, sans-serif" }}
    >
      <PdfHeader
        titulo="PROPOSTA TÉCNICA"
        numero={orcamento.numero}
        data={orcamento.data_criacao}
        tipoTrabalho={LABEL_TIPO[orcamento.tipo_trabalho] ?? orcamento.tipo_trabalho}
      />

      <section className="mb-6 break-inside-avoid">
        <h2 className="mb-2 font-montserrat text-sm font-bold uppercase text-brand">1. Por que isolar termicamente</h2>
        <p className="text-sm leading-relaxed text-gray-700">
          O isolamento térmico fixo reduz a troca de calor entre uma superfície (tubulação,
          equipamento ou envoltória) e o ambiente, trazendo ganhos diretos em quatro frentes:
          eficiência energética (menos combustível ou energia elétrica para manter a
          temperatura de processo), segurança (redução da temperatura de superfícies
          acessíveis, evitando queimaduras), controle de processo (temperaturas mais
          estáveis) e, em sistemas frios, prevenção de condensação e da corrosão e
          proliferação de mofo que ela causa ao longo do tempo.
        </p>
      </section>

      <section className="mb-6 break-inside-avoid">
        <h2 className="mb-2 font-montserrat text-sm font-bold uppercase text-brand">2. Princípios físicos aplicados</h2>
        <p className="text-sm leading-relaxed text-gray-700">
          O dimensionamento de cada trecho considera os três mecanismos de transferência de
          calor atuando em série: <strong>condução</strong> através da espessura do isolante
          (regida pela condutividade térmica k do material, que varia com a temperatura), e
          <strong> convecção</strong> (natural ou forçada pelo vento) somada à{" "}
          <strong>radiação</strong> na face externa, trocando calor com o ambiente. O ponto de
          equilíbrio entre esses mecanismos — a temperatura da face fria do isolamento — é
          encontrado por método iterativo, seguindo as práticas recomendadas pelas normas{" "}
          <strong>ASTM C680</strong> e <strong>ISO 12241</strong>, em conformidade com a{" "}
          <strong>ABNT NBR 16281</strong>.
        </p>
      </section>

      {temQuente && (
        <section className="mb-6 break-inside-avoid">
          <h2 className="mb-2 font-montserrat text-sm font-bold uppercase text-brand">
            3. Eficiência energética e redução de carbono
          </h2>
          <p className="mb-3 text-sm leading-relaxed text-gray-700">
            Em sistemas quentes, cada grau de temperatura perdido pela superfície para o
            ambiente representa energia comprada e não aproveitada no processo. Isolar reduz
            essa perda, o que se traduz em menor consumo de combustível ou eletricidade, menor
            custo operacional recorrente e menor emissão de CO₂ associada à queima desse
            combustível.
          </p>
          {itensQuentes.map((item) => (
            <div key={item.id} className="mb-3 rounded-card border-l-4 border-accent bg-accent-light/60 p-3 text-sm">
              <p className="font-montserrat font-semibold text-brand">
                {item.material}
                {item.acabamento ? ` · ${item.acabamento}` : ""}
              </p>
              <p>Perda de calor sem isolante: {formatarNumero(item.perda_sem_isolante, 3)} kW/m²</p>
              <p>Perda de calor com isolante: {formatarNumero(item.perda_com_isolante, 3)} kW/m²</p>
              {item.economia_anual != null && (
                <p>
                  Economia anual estimada: <strong className="text-accent-dark">{formatarMoeda(item.economia_anual)}</strong>
                </p>
              )}
              {item.co2_ton_ano != null && <p>CO₂ evitado por ano: {formatarNumero(item.co2_ton_ano, 2)} toneladas</p>}
            </div>
          ))}
        </section>
      )}

      {temFrio && (
        <section className="mb-6 break-inside-avoid">
          <h2 className="mb-2 font-montserrat text-sm font-bold uppercase text-brand">
            {temQuente ? "4." : "3."} Prevenção de condensação
          </h2>
          <p className="mb-3 text-sm leading-relaxed text-gray-700">
            Em sistemas frios, quando a temperatura da superfície isolada fica abaixo do{" "}
            <strong>ponto de orvalho</strong> do ar ambiente, o vapor de água presente no ar
            condensa sobre ela — causando corrosão sob isolamento, formação de mofo e gotejamento.
            A espessura mínima de cada trecho é calculada (fórmula de Magnus para o ponto de
            orvalho, combinada com o mesmo método iterativo de equilíbrio térmico) para manter a
            face fria do isolamento sempre acima dessa temperatura crítica.
          </p>
          {itensFrios.map((item) => (
            <div key={item.id} className="mb-3 rounded-card border-l-4 border-brand bg-brand-light/60 p-3 text-sm">
              <p className="font-montserrat font-semibold text-brand">{item.material}</p>
              <p>Espessura mínima recomendada: {formatarNumero(item.espessura_necessaria_mm, 1)} mm</p>
            </div>
          ))}
        </section>
      )}

      <section className="mb-6 break-inside-avoid">
        <h2 className="mb-2 font-montserrat text-sm font-bold uppercase text-brand">
          {temQuente && temFrio ? "5." : "4."} Especificação técnica por trecho
        </h2>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-brand-light text-left font-montserrat font-bold uppercase text-brand">
              <th className="border-b-2 border-brand/20 px-2 py-1.5">Trecho</th>
              <th className="border-b-2 border-brand/20 px-2 py-1.5">Material</th>
              <th className="border-b-2 border-brand/20 px-2 py-1.5">Geometria</th>
              <th className="border-b-2 border-brand/20 px-2 py-1.5">Área</th>
              <th className="border-b-2 border-brand/20 px-2 py-1.5">Espessura</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((item, index) => (
              <tr key={item.id} className="border-b border-gray-200 even:bg-gray-50">
                <td className="px-2 py-1.5">
                  {index + 1} ({LABEL_TIPO[item.tipo_trabalho]})
                </td>
                <td className="px-2 py-1.5">{item.material}</td>
                <td className="px-2 py-1.5">{item.geometria === "tubulacao" ? "Tubulação" : "Superfície plana"}</td>
                <td className="px-2 py-1.5">{formatarNumero(item.area_m2)} m²</td>
                <td className="px-2 py-1.5">{formatarNumero(item.espessura_necessaria_mm, 1)} mm</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {imagens.length > 0 && (
        <section className="mb-6 break-inside-avoid">
          <h2 className="mb-2 font-montserrat text-sm font-bold uppercase text-brand">Referências de obras executadas</h2>
          <div className="grid grid-cols-2 gap-3">
            {imagens.map((imagem, index) => (
              // eslint-disable-next-line @next/next/no-img-element
              <figure key={index}>
                <img
                  src={imagem.url}
                  alt={imagem.legenda ?? "Isolamento térmico"}
                  className="h-40 w-full rounded-card border border-gray-200 object-cover"
                />
                {imagem.legenda && <figcaption className="mt-1 text-xs text-gray-500">{imagem.legenda}</figcaption>}
              </figure>
            ))}
          </div>
        </section>
      )}

      <PdfFooter
        observacao="Proposta técnica sem valores comerciais — consulte a Proposta Comercial para o investimento."
        telefoneEmpresa={configEmpresa?.telefone_empresa}
        emailEmpresa={configEmpresa?.email_empresa}
      />
    </div>
  );
}
