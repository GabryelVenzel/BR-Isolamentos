"use client";

import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import { toast } from "./toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatarData } from "@/lib/format";
import type { ParceiroAnexo } from "@/lib/types/domain";

const BUCKET = "parceiros-anexos";
const LIMITE_BYTES = 20 * 1024 * 1024; // 20 MB
const LIMITE_ANEXOS = 10;

const ICONE_POR_TIPO: Record<string, string> = {
  pdf: "📄",
  doc: "📝",
  docx: "📝",
  xls: "📊",
  xlsx: "📊",
  jpg: "🖼️",
  jpeg: "🖼️",
  png: "🖼️",
  gif: "🖼️",
};

function extensao(nomeArquivo: string): string {
  return nomeArquivo.split(".").pop()?.toLowerCase() ?? "";
}

function formatarTamanho(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

interface Props {
  parceiroId: string;
}

/** Documentações necessárias do parceiro (certidões, apólices, contratos...)
 * — só disponível editando um parceiro já existente (pedido explícito: não
 * faz sentido pedir documentação antes do parceiro existir). Mesmo padrão
 * visual/mecanismo de AnexosLead.tsx (grid de cards, upload direto pro
 * Storage), com limite maior (20 MB — documentos digitalizados tendem a ser
 * maiores que os de um lead). */
export default function ParceiroAnexos({ parceiroId }: Props) {
  const [anexos, setAnexos] = useState<ParceiroAnexo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const response = await fetch(`/api/operacional/parceiros/${parceiroId}/anexos`);
      const payload = await response.json();
      if (payload.success) setAnexos(payload.data);
    } finally {
      setCarregando(false);
    }
  }, [parceiroId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function enviarArquivo(event: ChangeEvent<HTMLInputElement>) {
    const arquivo = event.target.files?.[0];
    if (!arquivo) return;

    if (anexos.length >= LIMITE_ANEXOS) {
      toast.erro(`Limite de ${LIMITE_ANEXOS} anexos por parceiro atingido.`);
      event.target.value = "";
      return;
    }

    if (arquivo.size > LIMITE_BYTES) {
      toast.erro("Arquivo maior que 20 MB — escolha um arquivo menor.");
      event.target.value = "";
      return;
    }

    setEnviando(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const caminho = `${parceiroId}/${Date.now()}-${arquivo.name}`;

      const { error: erroUpload } = await supabase.storage.from(BUCKET).upload(caminho, arquivo);
      if (erroUpload) {
        toast.erro(`Erro ao enviar arquivo: ${erroUpload.message}`);
        return;
      }

      const { data: publicUrl } = supabase.storage.from(BUCKET).getPublicUrl(caminho);

      const response = await fetch(`/api/operacional/parceiros/${parceiroId}/anexos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome_arquivo: arquivo.name,
          tipo_arquivo: extensao(arquivo.name),
          tamanho_bytes: arquivo.size,
          storage_path: caminho,
          url: publicUrl.publicUrl,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        toast.erro(payload.error ?? "Não foi possível salvar o anexo.");
        return;
      }

      toast.sucesso("Anexo adicionado.");
      setAnexos((prev) => [payload.data, ...prev]);
    } catch (error) {
      // Bug relatado (em AnexosLead.tsx — mesmo padrão aqui): faltava este
      // `catch`. Sem ele, qualquer exceção (rede, CORS, SDK do Supabase
      // lançando em vez de devolver `{ error }`) passava batido: o
      // `finally` limpava "Enviando..." e a tela voltava ao normal SEM
      // nenhum aviso, dando a impressão de que nada aconteceu.
      toast.erro(error instanceof Error ? `Erro ao enviar arquivo: ${error.message}` : "Erro ao enviar arquivo.");
    } finally {
      setEnviando(false);
      event.target.value = "";
    }
  }

  async function remover(anexo: ParceiroAnexo) {
    if (!confirm(`Remover "${anexo.nome_arquivo}"?`)) return;
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.storage.from(BUCKET).remove([anexo.storage_path]).catch(() => undefined);

      const response = await fetch(`/api/operacional/parceiros/${parceiroId}/anexos/${anexo.id}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        toast.erro(payload.error ?? "Não foi possível remover o anexo.");
        return;
      }
      toast.sucesso("Anexo removido.");
      setAnexos((prev) => prev.filter((a) => a.id !== anexo.id));
    } catch {
      toast.erro("Erro de conexão ao remover o anexo.");
    }
  }

  return (
    <div className="rounded-card border border-gray-200 p-4">
      <h3 className="mb-3 font-montserrat text-xs font-bold uppercase text-brand">
        📎 Anexos do Parceiro ({anexos.length}/{LIMITE_ANEXOS})
      </h3>
      <p className="mb-3 text-xs text-gray-400">Documentações necessárias para integrações (certidões, apólices, contratos...).</p>

      {carregando ? (
        <p className="text-sm text-gray-500">Carregando...</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {anexos.map((anexo) => (
            <div key={anexo.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="flex items-start gap-2">
                <span className="text-xl">{ICONE_POR_TIPO[anexo.tipo_arquivo] ?? "📎"}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-800" title={anexo.nome_arquivo}>
                    {anexo.nome_arquivo}
                  </p>
                  <p className="text-xs text-gray-400">
                    {formatarTamanho(anexo.tamanho_bytes)} · Adicionado em {formatarData(anexo.data_adicao)}
                  </p>
                </div>
              </div>
              <div className="mt-2 flex gap-3 text-xs">
                <a href={anexo.url} target="_blank" rel="noreferrer" className="text-brand hover:underline">
                  👁️ Ver
                </a>
                <a href={anexo.url} download={anexo.nome_arquivo} className="text-brand hover:underline">
                  ⬇️ Download
                </a>
                <button type="button" className="text-status-error hover:underline" onClick={() => remover(anexo)}>
                  🗑️ Remover
                </button>
              </div>
            </div>
          ))}
          {anexos.length === 0 && <p className="text-sm text-gray-400 sm:col-span-2">Nenhum anexo ainda.</p>}
        </div>
      )}

      {anexos.length < LIMITE_ANEXOS && (
        <label className="mt-3 flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-3 text-sm text-gray-500 hover:border-brand">
          <input type="file" className="hidden" disabled={enviando} onChange={enviarArquivo} />
          {enviando ? "Enviando..." : "+ Adicionar Anexo"}
        </label>
      )}
      <p className="mt-1 text-xs text-gray-400">PDF, Word, Excel ou imagem — até 20 MB por arquivo, até {LIMITE_ANEXOS} anexos.</p>
    </div>
  );
}
