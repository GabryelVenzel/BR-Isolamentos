"use client";

import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import { toast } from "./toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatarData } from "@/lib/format";
import type { FuncionarioAnexo } from "@/lib/types/domain";

const BUCKET = "rh-funcionarios-anexos";
const LIMITE_BYTES = 20 * 1024 * 1024; // 20 MB
// Pedido explícito: "podemos ter 15, 20 documentos entre certificações e
// documentações" — limite bem acima disso, só como salvaguarda (mesmo
// espírito dos limites de anexo já usados em parceiro/fornecedor/lead).
const LIMITE_ANEXOS = 40;

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
  funcionarioId: string;
}

/** Documentações do funcionário (ASO, NRs, certificações, contratos...) — só
 * disponível editando um funcionário já existente, mesmo padrão de
 * FornecedorAnexos.tsx, com um campo a mais: cada documento tem um NOME
 * próprio (digitado antes do upload, igual DocumentosEmpresa.tsx), não só o
 * nome cru do arquivo — pedido explícito ("ASO NRs etc"), e pode ser
 * renomeado depois. */
export default function FuncionarioAnexos({ funcionarioId }: Props) {
  const [anexos, setAnexos] = useState<FuncionarioAnexo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nomeEditado, setNomeEditado] = useState("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const response = await fetch(`/api/rh/funcionarios/${funcionarioId}/anexos`);
      const payload = await response.json();
      if (payload.success) setAnexos(payload.data);
    } finally {
      setCarregando(false);
    }
  }, [funcionarioId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function enviarArquivo(event: ChangeEvent<HTMLInputElement>) {
    const arquivo = event.target.files?.[0];
    if (!arquivo) return;

    if (!novoNome.trim()) {
      toast.erro("Informe o nome do documento antes de anexar o arquivo.");
      event.target.value = "";
      return;
    }
    if (anexos.length >= LIMITE_ANEXOS) {
      toast.erro(`Limite de ${LIMITE_ANEXOS} anexos por funcionário atingido.`);
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
      const caminho = `${funcionarioId}/${Date.now()}-${arquivo.name}`;

      const { error: erroUpload } = await supabase.storage.from(BUCKET).upload(caminho, arquivo);
      if (erroUpload) {
        toast.erro(`Erro ao enviar arquivo: ${erroUpload.message}`);
        return;
      }

      const { data: publicUrl } = supabase.storage.from(BUCKET).getPublicUrl(caminho);

      const response = await fetch(`/api/rh/funcionarios/${funcionarioId}/anexos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: novoNome.trim(),
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

      toast.sucesso("Documento adicionado.");
      setAnexos((prev) => [payload.data, ...prev]);
      setNovoNome("");
    } catch (error) {
      // Bug relatado em AnexosLead.tsx (mesmo padrão aqui): faltava este
      // `catch`. Sem ele, qualquer exceção (rede, CORS, SDK do Supabase
      // lançando em vez de devolver `{ error }`) passava batido, sem
      // nenhum aviso do que deu errado.
      toast.erro(error instanceof Error ? `Erro ao enviar arquivo: ${error.message}` : "Erro ao enviar arquivo.");
    } finally {
      setEnviando(false);
      event.target.value = "";
    }
  }

  function iniciarEdicao(anexo: FuncionarioAnexo) {
    setEditandoId(anexo.id);
    setNomeEditado(anexo.nome);
  }

  async function salvarEdicao(id: string) {
    if (!nomeEditado.trim()) {
      toast.erro("Informe o nome do documento.");
      return;
    }
    try {
      const response = await fetch(`/api/rh/funcionarios/${funcionarioId}/anexos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: nomeEditado.trim() }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        toast.erro(payload.error ?? "Não foi possível renomear o documento.");
        return;
      }
      toast.sucesso("Documento renomeado.");
      setAnexos((prev) => prev.map((a) => (a.id === id ? payload.data : a)));
      setEditandoId(null);
    } catch {
      toast.erro("Erro de conexão ao renomear o documento.");
    }
  }

  async function remover(anexo: FuncionarioAnexo) {
    if (!confirm(`Remover "${anexo.nome}"?`)) return;
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.storage.from(BUCKET).remove([anexo.storage_path]).catch(() => undefined);

      const response = await fetch(`/api/rh/funcionarios/${funcionarioId}/anexos/${anexo.id}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        toast.erro(payload.error ?? "Não foi possível remover o anexo.");
        return;
      }
      toast.sucesso("Documento removido.");
      setAnexos((prev) => prev.filter((a) => a.id !== anexo.id));
    } catch {
      toast.erro("Erro de conexão ao remover o documento.");
    }
  }

  return (
    <div className="rounded-card border border-gray-200 p-4">
      <h3 className="mb-3 font-montserrat text-xs font-bold uppercase text-brand">
        📎 Documentos do Funcionário ({anexos.length}/{LIMITE_ANEXOS})
      </h3>

      {carregando ? (
        <p className="text-sm text-gray-500">Carregando...</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {anexos.map((anexo) => (
            <div key={anexo.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="flex items-start gap-2">
                <span className="text-xl">{ICONE_POR_TIPO[anexo.tipo_arquivo] ?? "📎"}</span>
                <div className="min-w-0 flex-1">
                  {editandoId === anexo.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        className="input-field py-1 text-sm"
                        value={nomeEditado}
                        onChange={(e) => setNomeEditado(e.target.value)}
                        autoFocus
                      />
                      <button type="button" className="text-xs text-accent hover:underline" onClick={() => salvarEdicao(anexo.id)}>
                        OK
                      </button>
                    </div>
                  ) : (
                    <p className="truncate text-sm font-medium text-gray-800" title={anexo.nome}>
                      {anexo.nome}
                    </p>
                  )}
                  <p className="truncate text-xs text-gray-400" title={anexo.nome_arquivo}>
                    {anexo.nome_arquivo} · {formatarTamanho(anexo.tamanho_bytes)} · {formatarData(anexo.data_adicao)}
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
                <button type="button" className="text-brand hover:underline" onClick={() => iniciarEdicao(anexo)}>
                  ✏️ Renomear
                </button>
                <button type="button" className="text-status-error hover:underline" onClick={() => remover(anexo)}>
                  🗑️ Remover
                </button>
              </div>
            </div>
          ))}
          {anexos.length === 0 && <p className="text-sm text-gray-400 sm:col-span-2">Nenhum documento ainda.</p>}
        </div>
      )}

      {anexos.length < LIMITE_ANEXOS && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            className="input-field flex-1"
            placeholder='Nome do documento (ex.: "ASO", "NR-35"...)'
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
          />
          <label
            className={`flex cursor-pointer items-center justify-center whitespace-nowrap rounded-lg border-2 border-dashed p-2 px-4 text-sm ${
              novoNome.trim() ? "border-brand text-brand hover:bg-brand-light/40" : "border-gray-300 text-gray-400"
            }`}
          >
            <input type="file" className="hidden" disabled={enviando || !novoNome.trim()} onChange={enviarArquivo} />
            {enviando ? "Enviando..." : "+ Anexar"}
          </label>
        </div>
      )}
      <p className="mt-1 text-xs text-gray-400">PDF, Word, Excel ou imagem — até 20 MB por arquivo, até {LIMITE_ANEXOS} documentos.</p>
    </div>
  );
}
