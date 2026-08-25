// Geração de PDF a partir de um componente de preview (PDFPreviewComercial,
// PDFPreviewTecnica, ou os exports de aba do Resumo — DashboardGeral.tsx e
// companhia) renderizado na página (client-side only — html2canvas/jsPDF
// dependem do DOM/canvas do navegador). Usar dentro de um "use client".

const FORMATO_A4 = { orientation: "portrait" as const, unit: "mm" as const, format: "a4" as const };
// Dimensões A4 (210 x 297mm) com margem real de 10mm em cada lado — antes o
// conteúdo ia de borda a borda (imgWidth = pageWidth inteiro), o que fazia
// gráficos/texto colarem no limite físico da página impressa.
const MARGEM_MM = 10;

/** Sobe na árvore de um único filho por vez enquanto o nó só tem UM filho
 * elemento (ex.: `<div id="pdf-preview-tecnica"><PDFPreviewTecnica /></div>`
 * — o alvo real de captura é o filho, não o wrapper) — evita que o chamador
 * precise se preocupar em colocar o id no elemento "certo". */
function descerWrapperDeUmFilho(raiz: HTMLElement): HTMLElement {
  let atual = raiz;
  while (atual.children.length === 1 && !hasTextoProprio(atual)) {
    atual = atual.children[0] as HTMLElement;
  }
  return atual;
}

function hasTextoProprio(el: HTMLElement): boolean {
  return Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim());
}

/**
 * Gera o PDF capturando cada FILHO DIRETO do elemento como uma imagem
 * separada, em vez de tirar um print único da página inteira e fatiar por
 * altura fixa (o bug original: cortava gráficos/cards bem no meio sempre
 * que a fatia de `pageHeight` caía no meio de um elemento, produzindo
 * "gráficos cortados nas margens"). Cada filho direto já é uma unidade
 * visual completa nos componentes que usam isto — uma linha de grid
 * (`grid grid-cols-2 gap-4`), um `<section>` da proposta, um `.card` — então
 * capturá-los individualmente garante que a quebra de página só acontece
 * ENTRE unidades, nunca no meio de uma. Layouts internos (ex.: 2 gráficos
 * lado a lado num grid) são preservados porque o grid inteiro é capturado
 * como uma imagem só, não filho a filho dentro dele.
 */
export async function gerarPdfDeElemento(elementId: string): Promise<Blob> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  const raiz = document.getElementById(elementId);
  if (!raiz) {
    throw new Error(`Elemento #${elementId} não encontrado para gerar o PDF.`);
  }
  const elemento = descerWrapperDeUmFilho(raiz);

  const pdf = new jsPDF(FORMATO_A4);
  const larguraPagina = pdf.internal.pageSize.getWidth();
  const alturaPagina = pdf.internal.pageSize.getHeight();
  const larguraUtil = larguraPagina - MARGEM_MM * 2;
  const alturaUtil = alturaPagina - MARGEM_MM * 2;

  const blocos = Array.from(elemento.children).filter(
    (el): el is HTMLElement => el instanceof HTMLElement && el.offsetHeight > 0
  );
  // Se o elemento não tiver filhos "capturáveis" (ex.: texto solto, sem
  // sub-blocos), captura ele inteiro como um bloco único — mesmo
  // comportamento de antes, só sem a fatia por altura fixa.
  const alvos = blocos.length > 0 ? blocos : [elemento];

  let y = MARGEM_MM;
  let paginaTemConteudo = false;

  for (const bloco of alvos) {
    // scale 3 (~288 DPI efetivo numa página A4) — html2canvas não tem opção
    // de "dpi"/"quality" real (não existe esse parâmetro na lib); a única
    // alavanca de nitidez é renderizar em N vezes o tamanho e deixar o PDF
    // exibir reduzido. PNG via toDataURL já é sem perda, então não há
    // "qualidade" adicional a configurar na exportação em si.
    const canvas = await html2canvas(bloco, { scale: 3, useCORS: true, backgroundColor: "#ffffff" });
    if (canvas.width === 0 || canvas.height === 0) continue;

    const alturaImagem = (canvas.height * larguraUtil) / canvas.width;

    if (alturaImagem > alturaUtil) {
      // Bloco sozinho é mais alto que uma página inteira (gráfico grande,
      // lista longa de alertas...) — antes disso era desenhado do mesmo
      // jeito e o PDF simplesmente cortava tudo que passasse da borda da
      // última página ("PDF cortado"). Fatia o CANVAS (não o layout) em
      // pedaços do tamanho de uma página cada; cada fatia vira uma página
      // nova, então nada do conteúdo desaparece.
      if (paginaTemConteudo) {
        pdf.addPage();
        y = MARGEM_MM;
      }

      const pxPorMm = canvas.width / larguraUtil;
      const alturaFatiaPx = Math.floor(alturaUtil * pxPorMm);
      let offsetPx = 0;
      let alturaUltimaFatiaMm = 0;

      while (offsetPx < canvas.height) {
        const fatiaAlturaPx = Math.min(alturaFatiaPx, canvas.height - offsetPx);
        const fatia = document.createElement("canvas");
        fatia.width = canvas.width;
        fatia.height = fatiaAlturaPx;
        fatia
          .getContext("2d")!
          .drawImage(canvas, 0, offsetPx, canvas.width, fatiaAlturaPx, 0, 0, canvas.width, fatiaAlturaPx);

        alturaUltimaFatiaMm = fatiaAlturaPx / pxPorMm;
        pdf.addImage(fatia.toDataURL("image/png"), "PNG", MARGEM_MM, MARGEM_MM, larguraUtil, alturaUltimaFatiaMm);

        offsetPx += fatiaAlturaPx;
        if (offsetPx < canvas.height) pdf.addPage();
      }

      y = MARGEM_MM + alturaUltimaFatiaMm + 4;
      paginaTemConteudo = true;
      continue;
    }

    // Só quebra página se já tem algo desenhado nesta E o bloco não cabe no
    // espaço restante.
    if (paginaTemConteudo && y + alturaImagem > MARGEM_MM + alturaUtil) {
      pdf.addPage();
      y = MARGEM_MM;
      paginaTemConteudo = false;
    }

    const imgData = canvas.toDataURL("image/png");
    pdf.addImage(imgData, "PNG", MARGEM_MM, y, larguraUtil, alturaImagem);
    y += alturaImagem + 4; // 4mm de respiro entre blocos
    paginaTemConteudo = true;
  }

  return pdf.output("blob");
}

/** Dispara o download de qualquer `Blob` (PDF, CSV, ...) — o nome "baixarPdf"
 * ficou de quando só gerava proposta em PDF; a implementação em si já é
 * genérica. `baixarArquivo` é o mesmo helper com um nome que não mente sobre
 * o tipo de arquivo (ex.: export CSV do dashboard — ver app/resumo/page.tsx). */
export function baixarPdf(blob: Blob, nomeArquivo: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export const baixarArquivo = baixarPdf;
