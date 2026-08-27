"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import PropostaTecnicaDocument from "@/components/pdf-native/PropostaTecnicaDocument";
import PropostaComercialDocument from "@/components/pdf-native/PropostaComercialDocument";
import { baixarPdf } from "@/lib/pdf-generator";
import Link from "next/link";
import { gerarPropostaComercialDocx, gerarPropostaTecnicaDocx, nomeArquivoDocxComercial, nomeArquivoDocxTecnica } from "@/lib/docx-generator";
import type { ConfigEmpresa, Orcamento } from "@/lib/types";

// <PDFViewer> usa um <iframe> interno — só existe no navegador, precisa
// carregar sem SSR (mesmo motivo de html2canvas/jsPDF serem sempre import()
// dinâmico no resto do app: essas libs mexem em `window`/`document`, que não
// existem durante a renderização no servidor).
const PDFViewer = dynamic(() => import("@react-pdf/renderer").then((m) => m.PDFViewer), { ssr: false });

/** Propostas em PDF NATIVO (vetorial, texto selecionável, paginação A4 real)
 * via @react-pdf/renderer — substituiu a captura de tela (html2canvas +
 * jsPDF) que existia antes. Aquela abordagem, por mais que corrigida pra não
 * cortar conteúdo no meio (ver histórico de lib/pdf-generator.ts), ainda
 * produzia um PDF onde cada página era literalmente uma imagem PNG — texto
 * não selecionável/pesquisável, resolução limitada pela escala do canvas,
 * arquivo maior. @react-pdf/renderer desenha o PDF de verdade (texto, linhas,
 * tabelas como primitivos do próprio formato), e pagina em A4 sozinho sem
 * nenhuma lógica de corte manual — o componente <Page> já flui o conteúdo
 * que não cabe pra próxima folha.
 *
 * Esse motor de PDF novo cobre só as duas Propostas (o documento que vai pro
 * cliente, prioridade máxima) — os exports em PDF do dashboard Resumo
 * continuam em lib/pdf-generator.ts (html2canvas): são cheios de gráficos
 * (Recharts, SVG renderizado no navegador), que @react-pdf/renderer não
 * consegue desenhar diretamente (só entende os primitivos próprios dele, não
 * componentes React arbitrários) — reconstruir cada gráfico como desenho
 * vetorial nativo é um escopo bem maior, fora desta rodada.
 *
 * Sem galeria de imagens de referência (removida a pedido explícito — o
 * usuário vai montar um documento de portfólio à parte, com fotos das obras,
 * fora deste gerador). A infraestrutura (components/GaleriaImagensProposta.tsx,
 * tabela imagens_proposta, migração 022) continua existindo, só não é mais
 * usada aqui. */
export default function DownloadPdfPage() {
  const { id } = useParams<{ id: string }>();
  const [orcamento, setOrcamento] = useState<Orcamento | null>(null);
  const [configEmpresa, setConfigEmpresa] = useState<ConfigEmpresa | null>(null);
  const [gerando, setGerando] = useState<"comercial" | "tecnica" | "comercial-word" | "tecnica-word" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);
  const [abaPrevia, setAbaPrevia] = useState<"tecnica" | "comercial">("tecnica");

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

    fetch("/api/config-empresa")
      .then((r) => r.json())
      .then(setConfigEmpresa)
      .catch(() => setConfigEmpresa(null));
  }, [id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function baixarComercial() {
    if (!orcamento) return;
    setErro(null);
    setGerando("comercial");
    try {
      const { pdf } = await import("@react-pdf/renderer");
      const blob = await pdf(<PropostaComercialDocument orcamento={orcamento} configEmpresa={configEmpresa} />).toBlob();
      baixarPdf(blob, `Proposta_Comercial_${orcamento.numero}.pdf`);
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
      const { pdf } = await import("@react-pdf/renderer");
      const blob = await pdf(<PropostaTecnicaDocument orcamento={orcamento} configEmpresa={configEmpresa} />).toBlob();
      baixarPdf(blob, `Proposta_Tecnica_${orcamento.numero}.pdf`);
    } catch (err) {
      setErro(`Não foi possível gerar o PDF técnico.${err instanceof Error ? ` (${err.message})` : ""}`);
    } finally {
      setGerando(null);
    }
  }

  async function baixarTecnicaWord() {
    if (!orcamento) return;
    setErro(null);
    setGerando("tecnica-word");
    try {
      const blob = await gerarPropostaTecnicaDocx(orcamento, configEmpresa);
      baixarPdf(blob, nomeArquivoDocxTecnica(orcamento));
    } catch (err) {
      setErro(`Não foi possível gerar o Word da proposta técnica.${err instanceof Error ? ` (${err.message})` : ""}`);
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
      <div>
        <Link href="/historico" className="btn-secondary inline-block text-xs">
          ← Retornar ao Histórico
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">Propostas — {orcamento.numero}</h1>
          <p className="text-sm text-gray-500">Propostas prontas para download: técnica e comercial.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" className="btn-accent" onClick={baixarTecnica} disabled={gerando !== null}>
            {gerando === "tecnica" ? "Gerando..." : "Baixar Proposta Técnica (PDF)"}
          </button>
          <button type="button" className="btn-secondary" onClick={baixarTecnicaWord} disabled={gerando !== null}>
            {gerando === "tecnica-word" ? "Gerando..." : "Baixar Proposta Técnica (Word)"}
          </button>
          <button type="button" className="btn-primary" onClick={baixarComercial} disabled={gerando !== null}>
            {gerando === "comercial" ? "Gerando..." : "Baixar Proposta Comercial (PDF)"}
          </button>
          <button type="button" className="btn-secondary" onClick={baixarComercialWord} disabled={gerando !== null}>
            {gerando === "comercial-word" ? "Gerando..." : "Baixar Proposta Comercial (Word)"}
          </button>
        </div>
      </div>

      {/* Agora as duas propostas têm versão Word — ver comentário no topo de
          lib/docx-generator.ts pra decisão de escopo. */}

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <div>
        <div className="mb-2 flex gap-1 border-b border-gray-200">
          {(
            [
              ["tecnica", "Prévia — Proposta Técnica"],
              ["comercial", "Prévia — Proposta Comercial"],
            ] as const
          ).map(([valor, label]) => (
            <button
              key={valor}
              type="button"
              onClick={() => setAbaPrevia(valor)}
              className={`rounded-t-lg px-4 py-2 font-montserrat text-sm font-semibold transition-colors ${
                abaPrevia === valor ? "border-b-2 border-brand bg-brand-light text-brand" : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* A prévia é o PDF de verdade renderizado num <iframe> (mesmo motor
            que gera o arquivo baixado) — não uma segunda representação em
            HTML/CSS que poderia divergir do PDF real. */}
        <PDFViewer style={{ width: "100%", height: "80vh", border: "1px solid #e5e7eb", borderRadius: "12px" }}>
          {abaPrevia === "tecnica" ? (
            <PropostaTecnicaDocument orcamento={orcamento} configEmpresa={configEmpresa} />
          ) : (
            <PropostaComercialDocument orcamento={orcamento} configEmpresa={configEmpresa} />
          )}
        </PDFViewer>
      </div>
    </div>
  );
}
