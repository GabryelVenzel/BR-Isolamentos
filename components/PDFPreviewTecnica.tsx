import { formatarData, formatarMoeda, formatarNumero } from "@/lib/format";
import type { Orcamento } from "@/lib/types";

interface ImagemProposta {
  url: string;
  legenda: string | null;
}

interface Props {
  orcamento: Orcamento;
  imagens?: ImagemProposta[];
}

const LABEL_TIPO: Record<string, string> = { quente: "Quente", frio: "Frio", misto: "Misto (quente + frio)" };

/**
 * Proposta técnica — texto longo/conceitual, sem valores, explicando os princípios
 * físicos e os benefícios de cada item do orçamento. Adapta o conteúdo conforme o
 * orçamento seja quente, frio ou misto. Layout em HTML capturado via html2canvas
 * (lib/pdf-generator.ts).
 */
export default function PDFPreviewTecnica({ orcamento, imagens = [] }: Props) {
  const itens = [...(orcamento.itens ?? [])].sort((a, b) => a.ordem - b.ordem);
  const itensQuentes = itens.filter((i) => i.tipo_trabalho === "quente");
  const itensFrios = itens.filter((i) => i.tipo_trabalho === "frio");
  const temQuente = itensQuentes.length > 0;
  const temFrio = itensFrios.length > 0;

  return (
    <div className="mx-auto w-[210mm] bg-white p-10 text-gray-900" style={{ fontFamily: "Arial, sans-serif" }}>
      <header className="mb-8 flex items-center justify-between border-b-2 border-brand pb-4">
        <div>
          <h1 className="text-2xl font-bold text-brand">BR Isolamentos</h1>
          <p className="text-sm text-gray-500">Proposta técnica de isolamento térmico fixo</p>
        </div>
        <div className="text-right text-sm text-gray-500">
          <p>Nº {orcamento.numero}</p>
          <p>{formatarData(orcamento.data_criacao)}</p>
          <p>{LABEL_TIPO[orcamento.tipo_trabalho] ?? orcamento.tipo_trabalho}</p>
        </div>
      </header>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-bold uppercase text-brand">1. Por que isolar termicamente</h2>
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

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-bold uppercase text-brand">2. Princípios físicos aplicados</h2>
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
          <h2 className="mb-2 text-sm font-bold uppercase text-brand">3. Eficiência energética e redução de carbono</h2>
          <p className="mb-3 text-sm leading-relaxed text-gray-700">
            Em sistemas quentes, cada grau de temperatura perdido pela superfície para o
            ambiente representa energia comprada e não aproveitada no processo. Isolar reduz
            essa perda, o que se traduz em menor consumo de combustível ou eletricidade, menor
            custo operacional recorrente e menor emissão de CO₂ associada à queima desse
            combustível.
          </p>
          {itensQuentes.map((item) => (
            <div key={item.id} className="mb-3 rounded-lg bg-gray-50 p-3 text-sm">
              <p className="font-semibold">{item.material}{item.acabamento ? ` · ${item.acabamento}` : ""}</p>
              <p>Perda de calor sem isolante: {formatarNumero(item.perda_sem_isolante, 3)} kW/m²</p>
              <p>Perda de calor com isolante: {formatarNumero(item.perda_com_isolante, 3)} kW/m²</p>
              {item.economia_anual != null && <p>Economia anual estimada: {formatarMoeda(item.economia_anual)}</p>}
              {item.co2_ton_ano != null && <p>CO₂ evitado por ano: {formatarNumero(item.co2_ton_ano, 2)} toneladas</p>}
            </div>
          ))}
        </section>
      )}

      {temFrio && (
        <section className="mb-6 break-inside-avoid">
          <h2 className="mb-2 text-sm font-bold uppercase text-brand">
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
            <div key={item.id} className="mb-3 rounded-lg bg-gray-50 p-3 text-sm">
              <p className="font-semibold">{item.material}</p>
              <p>Espessura mínima recomendada: {formatarNumero(item.espessura_necessaria_mm, 1)} mm</p>
            </div>
          ))}
        </section>
      )}

      <section className="mb-6 break-inside-avoid">
        <h2 className="mb-2 text-sm font-bold uppercase text-brand">
          {temQuente && temFrio ? "5." : "4."} Especificação técnica por trecho
        </h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-300 text-left text-xs uppercase text-gray-500">
              <th className="py-1.5">Trecho</th>
              <th className="py-1.5">Material</th>
              <th className="py-1.5">Geometria</th>
              <th className="py-1.5">Área</th>
              <th className="py-1.5">Espessura</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((item, index) => (
              <tr key={item.id} className="border-b border-gray-100">
                <td className="py-1.5">{index + 1} ({LABEL_TIPO[item.tipo_trabalho]})</td>
                <td className="py-1.5">{item.material}</td>
                <td className="py-1.5">{item.geometria === "tubulacao" ? "Tubulação" : "Superfície plana"}</td>
                <td className="py-1.5">{formatarNumero(item.area_m2)} m²</td>
                <td className="py-1.5">{formatarNumero(item.espessura_necessaria_mm, 1)} mm</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {imagens.length > 0 && (
        <section className="mb-6 break-inside-avoid">
          <h2 className="mb-2 text-sm font-bold uppercase text-brand">Referências de obras executadas</h2>
          <div className="grid grid-cols-2 gap-3">
            {imagens.map((imagem, index) => (
              // eslint-disable-next-line @next/next/no-img-element
              <figure key={index}>
                <img src={imagem.url} alt={imagem.legenda ?? "Isolamento térmico"} className="h-40 w-full rounded-lg object-cover" />
                {imagem.legenda && <figcaption className="mt-1 text-xs text-gray-500">{imagem.legenda}</figcaption>}
              </figure>
            ))}
          </div>
        </section>
      )}

      <footer className="mt-10 border-t border-gray-200 pt-4 text-xs text-gray-400">
        Proposta técnica sem valores comerciais — consulte a Proposta Comercial para o
        investimento. Cálculos conforme ASTM C680 / ISO 12241 / ABNT NBR 16281.
      </footer>
    </div>
  );
}
