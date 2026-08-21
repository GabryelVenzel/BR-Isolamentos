"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import PDFPreview from "@/components/PDFPreview";
import { baixarPdf, gerarPdfOrcamento, nomeArquivoPdf } from "@/lib/pdf-generator";
import type { Orcamento } from "@/lib/types";

export default function DownloadPdfPage() {
  const { id } = useParams<{ id: string }>();
  const [orcamento, setOrcamento] = useState<Orcamento | null>(null);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/orcamentos/${id}`)
      .then((r) => r.json())
      .then(setOrcamento);
  }, [id]);

  async function baixar() {
    if (!orcamento) return;
    setErro(null);
    setGerando(true);
    try {
      const blob = await gerarPdfOrcamento("pdf-preview", orcamento);
      baixarPdf(blob, nomeArquivoPdf(orcamento));
    } catch {
      setErro("Não foi possível gerar o PDF.");
    } finally {
      setGerando(false);
    }
  }

  if (!orcamento) return <p className="text-sm text-gray-500">Carregando...</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">Proposta — {orcamento.numero}</h1>
          <p className="text-sm text-gray-500">Confira a prévia abaixo antes de baixar o PDF.</p>
        </div>
        <button type="button" className="btn-primary" onClick={baixar} disabled={gerando}>
          {gerando ? "Gerando PDF..." : "Baixar PDF"}
        </button>
      </div>

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-gray-100 p-6">
        <div id="pdf-preview">
          <PDFPreview orcamento={orcamento} />
        </div>
      </div>
    </div>
  );
}
