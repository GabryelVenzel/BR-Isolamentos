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
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)}KB` : `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

/** Upload de PDFs direto do navegador pro Supabase Storage — mesmo padrão de
 * components/GaleriaImagensProposta.tsx e
 * components/modules/operacional/ServicoDetailModal.tsx. Controla um array
 * de `AnexoLancamento` local; o componente pai inclui esse array no payload
 * de criar/editar o lançamento (não precisa de uma rota de upload própria,
 * `anexos` é só mais um campo do lançamento). */
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
    <div className="space-y-2 rounded-card border border-gray-200 p-3">
      <p className="text-xs font-semibold uppercase text-gray-500">Anexar PDFs (opcional)</p>
      <input type="file" accept="application/pdf" multiple disabled={enviando} onChange={selecionarArquivos} />

      {anexos.length > 0 && (
        <ul className="space-y-1">
          {anexos.map((anexo) => (
            <li key={anexo.url} className="flex items-center justify-between text-xs">
              <a href={anexo.url} target="_blank" rel="noreferrer" className="truncate text-brand hover:underline">
                📄 {anexo.nome} ({formatarTamanho(anexo.tamanho)})
              </a>
              <button type="button" className="text-status-error hover:underline" onClick={() => remover(anexo.url)}>
                ❌ Remover
              </button>
            </li>
          ))}
        </ul>
      )}

      {enviando && <p className="text-xs text-gray-500">Enviando...</p>}
      {erro && <p className="text-xs text-status-error">{erro}</p>}
      <p className="text-xs text-gray-400">Tipos aceitos: PDF · Máximo 10MB por arquivo · Até {MAXIMO_ARQUIVOS} arquivos.</p>
    </div>
  );
}
