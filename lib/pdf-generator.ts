// Geração de PDF a partir de um componente de preview (PDFPreviewComercial ou
// PDFPreviewTecnica) renderizado na página (client-side only — html2canvas/jsPDF
// dependem do DOM/canvas do navegador). Usar dentro de um "use client".

import type { Orcamento } from "./types";

export async function gerarPdfDeElemento(elementId: string): Promise<Blob> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  const elemento = document.getElementById(elementId);
  if (!elemento) {
    throw new Error(`Elemento #${elementId} não encontrado para gerar o PDF.`);
  }

  const canvas = await html2canvas(elemento, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
  });

  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  return pdf.output("blob");
}

export function nomeArquivoPdfComercial(orcamento: Orcamento): string {
  return `Proposta_Comercial_${orcamento.numero}.pdf`;
}

export function nomeArquivoPdfTecnica(orcamento: Orcamento): string {
  return `Proposta_Tecnica_${orcamento.numero}.pdf`;
}

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
