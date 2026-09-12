"use client";

import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import ToastContainer from "@/components/modules/rh/ToastContainer";
import { toast } from "@/components/modules/rh/toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatarData } from "@/lib/format";
import type { DocumentoEmpresa } from "@/lib/types/domain";

const BUCKET = "rh-empresa-anexos";
const LIMITE_BYTES = 20 * 1024 * 1024; // 20 MB

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

/** Aba "Empresa" do módulo RH (migração 033) — lista solta de documentos da
 * empresa (CNPJ, Contrato Social, PGR, PCMSO, contratos...), cada um com um
 * nome dado pelo usuário + 1 anexo. Diferente dos anexos de Parceiro/
 * Fornecedor (que só têm o nome cru do arquivo), aqui o nome é digitado
 * ANTES do upload e pode ser editado depois (pedido explícito: "colocamos o
 * nome do documento e subimos o anexo gerando uma lista que pode ser
 * excluída ou editada"). */
export default function RhEmpresaPage() {
  const [documentos, setDocumentos] = useState<DocumentoEmpresa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [novoNome, setNovoNome] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nomeEditado, setNomeEditado] = useState("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const response = await fetch("/api/rh/documentos");
      const payload = await response.json();
      if (payload.success) setDocumentos(payload.data);
    } finally {
      setCarregando(false);
    }
  }, []);

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
    if (arquivo.size > LIMITE_BYTES) {
      toast.erro("Arquivo maior que 20 MB — escolha um arquivo menor.");
      event.target.value = "";
      return;
    }

    setEnviando(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const caminho = `${Date.now()}-${arquivo.name}`;

      const { error: erroUpload } = await supabase.storage.from(BUCKET).upload(caminho, arquivo);
      if (erroUpload) {
        toast.erro(`Erro ao enviar arquivo: ${erroUpload.message}`);
        return;
      }

      const { data: publicUrl } = supabase.storage.from(BUCKET).getPublicUrl(caminho);

      const response = await fetch("/api/rh/documentos", {
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
        toast.erro(payload.error ?? "Não foi possível salvar o documento.");
        return;
      }

      toast.sucesso("Documento adicionado.");
      setDocumentos((prev) => [...prev, payload.data].sort((a, b) => a.nome.localeCompare(b.nome)));
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

  function iniciarEdicao(documento: DocumentoEmpresa) {
    setEditandoId(documento.id);
    setNomeEditado(documento.nome);
  }

  async function salvarEdicao(id: string) {
    if (!nomeEditado.trim()) {
      toast.erro("Informe o nome do documento.");
      return;
    }
    try {
      const response = await fetch(`/api/rh/documentos/${id}`, {
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
      setDocumentos((prev) => prev.map((d) => (d.id === id ? payload.data : d)).sort((a, b) => a.nome.localeCompare(b.nome)));
      setEditandoId(null);
    } catch {
      toast.erro("Erro de conexão ao renomear o documento.");
    }
  }

  async function remover(documento: DocumentoEmpresa) {
    if (!confirm(`Excluir o documento "${documento.nome}"?`)) return;
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.storage.from(BUCKET).remove([documento.storage_path]).catch(() => undefined);

      const response = await fetch(`/api/rh/documentos/${documento.id}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        toast.erro(payload.error ?? "Não foi possível excluir o documento.");
        return;
      }
      toast.sucesso("Documento excluído.");
      setDocumentos((prev) => prev.filter((d) => d.id !== documento.id));
    } catch {
      toast.erro("Erro de conexão ao excluir o documento.");
    }
  }

  return (
    <div className="space-y-6">
      <ToastContainer />

      <div>
        <h1 className="text-2xl font-bold">Documentos da Empresa</h1>
        <p className="text-sm text-gray-500">
          CNPJ, Contrato Social, PGR, PCMSO, contratos e demais documentações da empresa — digite o nome do documento
          e anexe o arquivo correspondente.
        </p>
      </div>

      <div className="card space-y-2">
        <label className="label-field">Nome do documento</label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            className="input-field flex-1"
            placeholder='Ex.: "Contrato Social", "PGR 2026"...'
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
          />
          <label
            className={`flex cursor-pointer items-center justify-center whitespace-nowrap rounded-lg border-2 border-dashed p-2 px-4 text-sm ${
              novoNome.trim() ? "border-brand text-brand hover:bg-brand-light/40" : "border-gray-300 text-gray-400"
            }`}
          >
            <input type="file" className="hidden" disabled={enviando || !novoNome.trim()} onChange={enviarArquivo} />
            {enviando ? "Enviando..." : "+ Anexar arquivo"}
          </label>
        </div>
        <p className="text-xs text-gray-400">PDF, Word, Excel ou imagem — até 20 MB por arquivo.</p>
      </div>

      {carregando ? (
        <p className="text-sm text-gray-500">Carregando...</p>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-2 text-left">Documento</th>
                <th className="px-4 py-2 text-left">Arquivo</th>
                <th className="px-4 py-2 text-left">Adicionado em</th>
                <th className="px-4 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {documentos.map((documento) => (
                <tr key={documento.id}>
                  <td className="px-4 py-2 font-medium text-brand">
                    {editandoId === documento.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          className="input-field"
                          value={nomeEditado}
                          onChange={(e) => setNomeEditado(e.target.value)}
                          autoFocus
                        />
                        <button type="button" className="text-xs text-accent hover:underline" onClick={() => salvarEdicao(documento.id)}>
                          Salvar
                        </button>
                        <button type="button" className="text-xs text-gray-400 hover:underline" onClick={() => setEditandoId(null)}>
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      documento.nome
                    )}
                  </td>
                  <td className="px-4 py-2 text-gray-500">
                    <span className="mr-1">{ICONE_POR_TIPO[documento.tipo_arquivo] ?? "📎"}</span>
                    {documento.nome_arquivo} <span className="text-xs text-gray-400">({formatarTamanho(documento.tamanho_bytes)})</span>
                  </td>
                  <td className="px-4 py-2 text-gray-500">{formatarData(documento.data_adicao)}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-end gap-3 text-xs">
                      <a href={documento.url} target="_blank" rel="noreferrer" className="text-brand hover:underline">
                        👁️ Ver
                      </a>
                      <a href={documento.url} download={documento.nome_arquivo} className="text-brand hover:underline">
                        ⬇️
                      </a>
                      <button type="button" className="hover:opacity-70" title="Editar nome" onClick={() => iniciarEdicao(documento)}>
                        ✏️
                      </button>
                      <button type="button" className="text-status-error hover:underline" onClick={() => remover(documento)}>
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {documentos.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-gray-400">
                    Nenhum documento cadastrado ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
