"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import PDFPreviewComercial from "@/components/PDFPreviewComercial";
import PDFPreviewTecnica from "@/components/PDFPreviewTecnica";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  baixarPdf,
  gerarPdfDeElemento,
  nomeArquivoPdfComercial,
  nomeArquivoPdfTecnica,
} from "@/lib/pdf-generator";
import type { Orcamento } from "@/lib/types";

interface ImagemProposta {
  url: string;
  legenda: string | null;
}

export default function DownloadPdfPage() {
  const { id } = useParams<{ id: string }>();
  const [orcamento, setOrcamento] = useState<Orcamento | null>(null);
  const [imagens, setImagens] = useState<ImagemProposta[]>([]);
  const [gerando, setGerando] = useState<"comercial" | "tecnica" | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/orcamentos/${id}`)
      .then((r) => r.json())
      .then(setOrcamento);

    const supabase = createSupabaseBrowserClient();
    supabase
      .from("imagens_proposta")
      .select("url, legenda")
      .then(({ data }) => setImagens(data ?? []));
  }, [id]);

  async function baixarComercial() {
    if (!orcamento) return;
    setErro(null);
    setGerando("comercial");
    try {
      const blob = await gerarPdfDeElemento("pdf-preview-comercial");
      baixarPdf(blob, nomeArquivoPdfComercial(orcamento));
    } catch {
      setErro("Não foi possível gerar o PDF comercial.");
    } finally {
      setGerando(null);
    }
  }

  async function baixarTecnica() {
    if (!orcamento) return;
    setErro(null);
    setGerando("tecnica");
    try {
      const blob = await gerarPdfDeElemento("pdf-preview-tecnica");
      baixarPdf(blob, nomeArquivoPdfTecnica(orcamento));
    } catch {
      setErro("Não foi possível gerar o PDF técnico.");
    } finally {
      setGerando(null);
    }
  }

  if (!orcamento) return <p className="text-sm text-gray-500">Carregando...</p>;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">Propostas — {orcamento.numero}</h1>
          <p className="text-sm text-gray-500">Duas propostas prontas para download: técnica e comercial.</p>
        </div>
        <div className="flex gap-3">
          <button type="button" className="btn-secondary" onClick={baixarTecnica} disabled={gerando !== null}>
            {gerando === "tecnica" ? "Gerando..." : "Baixar Proposta Técnica"}
          </button>
          <button type="button" className="btn-primary" onClick={baixarComercial} disabled={gerando !== null}>
            {gerando === "comercial" ? "Gerando..." : "Baixar Proposta Comercial"}
          </button>
        </div>
      </div>

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <div>
        <h2 className="mb-2 text-sm font-semibold text-gray-500">Prévia — Proposta Técnica</h2>
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-gray-100 p-6">
          <div id="pdf-preview-tecnica">
            <PDFPreviewTecnica orcamento={orcamento} imagens={imagens} />
          </div>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-gray-500">Prévia — Proposta Comercial</h2>
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-gray-100 p-6">
          <div id="pdf-preview-comercial">
            <PDFPreviewComercial orcamento={orcamento} />
          </div>
        </div>
      </div>
    </div>
  );
}
