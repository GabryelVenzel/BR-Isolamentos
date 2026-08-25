"use client";

import { useCallback, useEffect, useState } from "react";
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
import { gerarPropostaComercialDocx, nomeArquivoDocxComercial } from "@/lib/docx-generator";
import type { ConfigEmpresa, Orcamento } from "@/lib/types";

interface ImagemProposta {
  url: string;
  legenda: string | null;
}

export default function DownloadPdfPage() {
  const { id } = useParams<{ id: string }>();
  const [orcamento, setOrcamento] = useState<Orcamento | null>(null);
  const [imagens, setImagens] = useState<ImagemProposta[]>([]);
  const [configEmpresa, setConfigEmpresa] = useState<ConfigEmpresa | null>(null);
  const [gerando, setGerando] = useState<"comercial" | "tecnica" | "comercial-word" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setErroCarregamento(null);
    try {
      const resposta = await fetch(`/api/orcamentos/${id}`);
      const dados = await resposta.json();
      if (!resposta.ok) {
        setErroCarregamento(dados?.error ?? "Não foi possível carregar este orçamento.");
        return;
      }
      setOrcamento(dados);
    } catch {
      setErroCarregamento("Erro de conexão ao carregar o orçamento.");
      return;
    }

    // Telefone/e-mail reais da empresa (cadastrados em Configurar Preços) para
    // o rodapé da proposta — ver components/pdf/PdfFooter.tsx.
    fetch("/api/config-empresa")
      .then((r) => r.json())
      .then(setConfigEmpresa)
      .catch(() => setConfigEmpresa(null));

    // As imagens de referência são um "bônus" da proposta — se o Storage/
    // Supabase falhar aqui (ex.: variáveis de ambiente do navegador
    // indisponíveis nesse deploy), a página não deve travar por isso: a
    // proposta continua gerável, só sem as fotos. Antes este bloco chamava
    // createSupabaseBrowserClient() direto dentro do useEffect, sem
    // try/catch — se as env vars faltassem, a exceção derrubava a página
    // inteira (ver app/error.tsx) em vez de só a galeria de imagens.
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.from("imagens_proposta").select("url, legenda");
      if (error) throw error;
      setImagens(data ?? []);
    } catch {
      setImagens([]);
    }
  }, [id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function baixarComercial() {
    if (!orcamento) return;
    setErro(null);
    setGerando("comercial");
    try {
      const blob = await gerarPdfDeElemento("pdf-preview-comercial");
      baixarPdf(blob, nomeArquivoPdfComercial(orcamento));
    } catch (err) {
      setErro(`Não foi possível gerar o PDF comercial.${err instanceof Error ? ` (${err.message})` : ""}`);
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
    } catch (err) {
      setErro(`Não foi possível gerar o PDF técnico.${err instanceof Error ? ` (${err.message})` : ""}`);
    } finally {
      setGerando(null);
    }
  }

  async function baixarComercialWord() {
    if (!orcamento) return;
    setErro(null);
    setGerando("comercial-word");
    try {
      const blob = await gerarPropostaComercialDocx(orcamento, configEmpresa);
      baixarPdf(blob, nomeArquivoDocxComercial(orcamento));
    } catch (err) {
      setErro(`Não foi possível gerar o Word da proposta comercial.${err instanceof Error ? ` (${err.message})` : ""}`);
    } finally {
      setGerando(null);
    }
  }

  if (erroCarregamento) {
    return (
      <div className="card max-w-lg text-sm text-status-error">
        <p>{erroCarregamento}</p>
        <button type="button" className="btn-secondary mt-3" onClick={carregar}>
          Tentar de novo
        </button>
      </div>
    );
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
          <button type="button" className="btn-accent" onClick={baixarTecnica} disabled={gerando !== null}>
            {gerando === "tecnica" ? "Gerando..." : "Baixar Proposta Técnica"}
          </button>
          <button type="button" className="btn-primary" onClick={baixarComercial} disabled={gerando !== null}>
            {gerando === "comercial" ? "Gerando..." : "Baixar Proposta Comercial (PDF)"}
          </button>
          <button type="button" className="btn-secondary" onClick={baixarComercialWord} disabled={gerando !== null}>
            {gerando === "comercial-word" ? "Gerando..." : "Baixar Proposta Comercial (Word)"}
          </button>
        </div>
      </div>

      {/* Só a Proposta Comercial tem versão Word — ver comentário no topo de
          lib/docx-generator.ts pra decisão de escopo. */}

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <div>
        <h2 className="mb-2 text-sm font-semibold text-gray-500">Prévia — Proposta Técnica</h2>
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-gray-100 p-6">
          <div id="pdf-preview-tecnica">
            <PDFPreviewTecnica orcamento={orcamento} imagens={imagens} configEmpresa={configEmpresa} />
          </div>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-gray-500">Prévia — Proposta Comercial</h2>
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-gray-100 p-6">
          <div id="pdf-preview-comercial">
            <PDFPreviewComercial orcamento={orcamento} configEmpresa={configEmpresa} />
          </div>
        </div>
      </div>
    </div>
  );
}
