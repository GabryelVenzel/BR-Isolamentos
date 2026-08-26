"use client";

import { useState, type ChangeEvent } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { AnexoLancamento } from "@/lib/types/domain";

const BUCKET = "lancamentos-anexos";
const TAMANHO_MAXIMO_BYTES = 10 * 1024 * 1024; // 10MB
const MAXIMO_ARQUIVOS = 5;

interface Props {
  anexos: AnexoLancamento[];
  onChange: (anexos: AnexoLancamento[]) => void;
}

function formatarTamanho(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Upload de PDFs direto do navegador pro Supabase Storage — mesmo padrão de
 * components/GaleriaImagensProposta.tsx e
 * components/modules/operacional/ServicoDetailModal.tsx. Controla um array
 * de `AnexoLancamento` local; o componente pai inclui esse array no payload
 * de criar/editar o lançamento (não precisa de uma rota de upload própria,
 * `anexos` é só mais um campo do lançamento).
 *
 * Visual: grid de cards (mesmo padrão de AnexosLead.tsx/ParceiroAnexos.tsx/
 * FornecedorAnexos.tsx) em vez do `<input type="file">` cru + lista de texto
 * de antes — pedido explícito de consistência visual entre os módulos. */
export default function AnexosUpload({ anexos, onChange }: Props) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function selecionarArquivos(event: ChangeEvent<HTMLInputElement>) {
    const arquivos = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (arquivos.length === 0) return;

    setErro(null);

    if (anexos.length + arquivos.length > MAXIMO_ARQUIVOS) {
      setErro(`Máximo de ${MAXIMO_ARQUIVOS} arquivos por lançamento.`);
      return;
    }
    for (const arquivo of arquivos) {
      if (arquivo.type !== "application/pdf") {
        setErro(`"${arquivo.name}" não é um PDF.`);
        return;
      }
      if (arquivo.size > TAMANHO_MAXIMO_BYTES) {
        setErro(`"${arquivo.name}" passa de 10MB.`);
        return;
      }
    }

    setEnviando(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const novosAnexos: AnexoLancamento[] = [];

      for (const arquivo of arquivos) {
        const caminho = `${Date.now()}-${arquivo.name}`;
        const { error: erroUpload } = await supabase.storage.from(BUCKET).upload(caminho, arquivo);
        if (erroUpload) {
          setErro(`Erro ao enviar "${arquivo.name}": ${erroUpload.message}`);
          continue;
        }
        const { data: publicUrl } = supabase.storage.from(BUCKET).getPublicUrl(caminho);
        novosAnexos.push({
          url: publicUrl.publicUrl,
          nome: arquivo.name,
          tamanho: arquivo.size,
          statusValidacao: "pending",
          notasValidacao: null,
        });
      }

      if (novosAnexos.length > 0) onChange([...anexos, ...novosAnexos]);
    } finally {
      setEnviando(false);
    }
  }

  function remover(url: string) {
    onChange(anexos.filter((a) => a.url !== url));
  }

  return (
    <div className="rounded-card border border-gray-200 p-4">
      <h3 className="mb-3 font-montserrat text-xs font-bold uppercase text-brand">
        📎 Anexos (opcional) — {anexos.length}/{MAXIMO_ARQUIVOS}
      </h3>

      {anexos.length > 0 && (
        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {anexos.map((anexo) => (
            <div key={anexo.url} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="flex items-start gap-2">
                <span className="text-xl">📄</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-800" title={anexo.nome}>
                    {anexo.nome}
                  </p>
                  <p className="text-xs text-gray-400">{formatarTamanho(anexo.tamanho)}</p>
                </div>
              </div>
              <div className="mt-2 flex gap-3 text-xs">
                <a href={anexo.url} target="_blank" rel="noreferrer" className="text-brand hover:underline">
                  👁️ Ver
                </a>
                <a href={anexo.url} download={anexo.nome} className="text-brand hover:underline">
                  ⬇️ Download
                </a>
                <button type="button" className="text-status-error hover:underline" onClick={() => remover(anexo.url)}>
                  🗑️ Remover
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {anexos.length === 0 && <p className="mb-3 text-sm text-gray-400">Nenhum anexo ainda.</p>}

      {anexos.length < MAXIMO_ARQUIVOS && (
        <label className="flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-3 text-sm text-gray-500 hover:border-brand">
          <input type="file" accept="application/pdf" multiple disabled={enviando} className="hidden" onChange={selecionarArquivos} />
          📤 {enviando ? "Enviando..." : "Adicionar Anexo"}
        </label>
      )}

      {erro && <p className="mt-2 text-xs text-status-error">{erro}</p>}
      <p className="mt-1 text-xs text-gray-400">PDF — até 10MB por arquivo, até {MAXIMO_ARQUIVOS} anexos.</p>
    </div>
  );
}
