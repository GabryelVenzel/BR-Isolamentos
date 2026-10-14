"use client";

import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import { toast } from "./toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { urlArquivo } from "@/lib/arquivos";
import SeloValidade from "@/components/ui/SeloValidade";
import { documentosVigentes, validadePadrao, type TipoDocumentoRh } from "@/lib/rh";
import { formatarData } from "@/lib/format";
import type { FuncionarioAnexo } from "@/lib/types/domain";
import { confirmar } from "@/components/ui/confirmar";
import IconeArquivo from "@/components/ui/IconeArquivo";
import { Download, Eye, Paperclip, Pencil, Trash2 } from "lucide-react";

const BUCKET = "rh-funcionarios-anexos";
const LIMITE_BYTES = 20 * 1024 * 1024; // 20 MB
// Pedido explícito: "podemos ter 15, 20 documentos entre certificações e
// documentações" — limite bem acima disso, só como salvaguarda (mesmo
// espírito dos limites de anexo já usados em parceiro/fornecedor/lead).
const LIMITE_ANEXOS = 40;

function extensao(nomeArquivo: string): string {
  return nomeArquivo.split(".").pop()?.toLowerCase() ?? "";
}

function formatarTamanho(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

interface Props {
  funcionarioId: string;
  /** Tipos padrão (RH → Configurações, migração 052). */
  tiposDocumento?: TipoDocumentoRh[];
  diasAviso?: number;
}

/** Documentações do funcionário (ASO, NRs, certificações, contratos...) — só
 * disponível editando um funcionário já existente, mesmo padrão de
 * FornecedorAnexos.tsx, com um campo a mais: cada documento tem um NOME
 * próprio (digitado antes do upload, igual DocumentosEmpresa.tsx), não só o
 * nome cru do arquivo — pedido explícito ("ASO NRs etc"), e pode ser
 * renomeado depois. */
export default function FuncionarioAnexos({ funcionarioId, tiposDocumento = [], diasAviso = 30 }: Props) {
  const [anexos, setAnexos] = useState<FuncionarioAnexo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novaValidade, setNovaValidade] = useState("");
  // Migração 052 — tipo padrão e emissão: a validade é calculada pelo tipo.
  const [novoTipo, setNovoTipo] = useState("");
  const [novaEmissao, setNovaEmissao] = useState("");
  const [validadeEditada, setValidadeEditada] = useState("");
  const [tipoEditado, setTipoEditado] = useState("");
  const [emissaoEditada, setEmissaoEditada] = useState("");
  const tipoPorId = (id: string | null | undefined) => tiposDocumento.find((t) => t.id === id);

  // Escolher o tipo preenche o nome; emissão + tipo preenchem a validade.
  function escolherTipo(id: string) {
    setNovoTipo(id);
    const tipo = tipoPorId(id);
    if (tipo) setNovoNome(tipo.nome);
    const validade = validadePadrao(tipo, novaEmissao);
    if (validade) setNovaValidade(validade);
  }
  function mudarEmissao(data: string) {
    setNovaEmissao(data);
    const validade = validadePadrao(tipoPorId(novoTipo), data);
    if (validade) setNovaValidade(validade);
  }
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
          validade: novaValidade || null,
          tipo_id: novoTipo || null,
          data_emissao: novaEmissao || null,
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
      setNovaValidade("");
      setNovoTipo("");
      setNovaEmissao("");
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
    setValidadeEditada(anexo.validade ?? "");
    setTipoEditado(anexo.tipo_id ?? "");
    setEmissaoEditada(anexo.data_emissao ?? "");
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
        body: JSON.stringify({ nome: nomeEditado.trim(), validade: validadeEditada || null, tipo_id: tipoEditado || null, data_emissao: emissaoEditada || null }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        toast.erro(payload.error ?? "Não foi possível renomear o documento.");
        return;
      }
      toast.sucesso("Documento atualizado.");
      setAnexos((prev) => prev.map((a) => (a.id === id ? payload.data : a)));
      setEditandoId(null);
    } catch {
      toast.erro("Erro de conexão ao renomear o documento.");
    }
  }

  async function remover(anexo: FuncionarioAnexo) {
    if (!(await confirmar(`Remover "${anexo.nome}"?`))) return;
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

  // Renovado (migração 052): de cada tipo só o mais novo vale; os demais
  // aparecem como substituídos.
  const vigentes = new Set(documentosVigentes(anexos).map((a) => a.id));
  const substituidos = new Set(anexos.filter((a) => a.tipo_id && !vigentes.has(a.id)).map((a) => a.id));

  return (
    <div className="rounded-card border border-gray-200 p-4">
      <h3 className="mb-3 font-montserrat text-xs font-bold uppercase text-brand">
        <Paperclip className="icone" aria-hidden /> Documentos do Funcionário ({anexos.length}/{LIMITE_ANEXOS})
      </h3>

      {carregando ? (
        <p className="text-sm text-gray-500">Carregando...</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {anexos.map((anexo) => (
            <div key={anexo.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="flex items-start gap-2">
                <IconeArquivo tipo={anexo.tipo_arquivo} />
                <div className="min-w-0 flex-1">
                  {editandoId === anexo.id ? (
                    <div className="flex flex-wrap items-center gap-1">
                      <input
                        aria-label="Nome do documento"
                        className="input-field py-1 text-sm"
                        value={nomeEditado}
                        onChange={(e) => setNomeEditado(e.target.value)}
                        autoFocus
                      />
                      <select aria-label="Tipo" className="input-field py-1 text-sm" value={tipoEditado} onChange={(e) => setTipoEditado(e.target.value)}>
                        <option value="">Sem tipo</option>
                        {tiposDocumento.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.nome}
                          </option>
                        ))}
                      </select>
                      <input
                        type="date"
                        aria-label="Emissão"
                        title="Emissão"
                        className="input-field py-1 text-sm"
                        value={emissaoEditada}
                        onChange={(e) => {
                          setEmissaoEditada(e.target.value);
                          const validade = validadePadrao(tipoPorId(tipoEditado), e.target.value);
                          if (validade) setValidadeEditada(validade);
                        }}
                      />
                      <input
                        type="date"
                        aria-label="Validade"
                        title="Validade"
                        className="input-field py-1 text-sm"
                        value={validadeEditada}
                        onChange={(e) => setValidadeEditada(e.target.value)}
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
                  {editandoId !== anexo.id && (
                    <>
                      {(tipoPorId(anexo.tipo_id) || anexo.data_emissao) && (
                        <p className="mt-1 text-xs text-gray-500">
                          {tipoPorId(anexo.tipo_id)?.nome}
                          {tipoPorId(anexo.tipo_id) && anexo.data_emissao ? " · " : ""}
                          {anexo.data_emissao ? `emitido em ${formatarData(anexo.data_emissao)}` : ""}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-gray-600">
                        {substituidos.has(anexo.id) ? (
                          <span className="text-gray-400">Substituído por um documento mais novo do mesmo tipo — não conta como pendência.</span>
                        ) : (
                          <>
                            Validade: <SeloValidade validade={anexo.validade} diasAviso={diasAviso} />
                          </>
                        )}
                      </p>
                    </>
                  )}
                </div>
              </div>
              <div className="mt-2 flex gap-3 text-xs">
                <a href={urlArquivo(anexo.url)} target="_blank" rel="noreferrer" className="text-brand hover:underline">
                  <Eye className="icone" aria-hidden /> Ver
                </a>
                <a href={urlArquivo(anexo.url, { baixarComo: anexo.nome_arquivo })} className="text-brand hover:underline">
                  <Download className="icone" aria-hidden /> Download
                </a>
                <button type="button" className="text-brand hover:underline" onClick={() => iniciarEdicao(anexo)}>
                  <Pencil className="icone" aria-hidden /> Editar
                </button>
                <button type="button" className="text-status-error hover:underline" onClick={() => remover(anexo)}>
                  <Trash2 className="icone" aria-hidden /> Remover
                </button>
              </div>
            </div>
          ))}
          {anexos.length === 0 && <p className="text-sm text-gray-400 sm:col-span-2">Nenhum documento ainda.</p>}
        </div>
      )}

      {anexos.length < LIMITE_ANEXOS && (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[1.2fr_1.4fr_auto_auto_auto]">
          <div>
            <label className="label-field">Tipo</label>
            <select className="input-field" aria-label="Tipo do documento" value={novoTipo} onChange={(e) => escolherTipo(e.target.value)}>
              <option value="">Outro (sem tipo)</option>
              {tiposDocumento.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                  {t.validade_meses ? ` — vale ${t.validade_meses} ${t.validade_meses === 1 ? "mês" : "meses"}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-field">Nome</label>
            <input className="input-field" placeholder='Ex.: "ASO", "NR-35"...' value={novoNome} onChange={(e) => setNovoNome(e.target.value)} />
          </div>
          <div>
            <label className="label-field">Emissão</label>
            <input type="date" aria-label="Data de emissão" className="input-field" value={novaEmissao} onChange={(e) => mudarEmissao(e.target.value)} />
          </div>
          <div>
            <label className="label-field">Validade</label>
            <input type="date" aria-label="Validade do documento (opcional)" className="input-field" value={novaValidade} onChange={(e) => setNovaValidade(e.target.value)} />
          </div>
          <label
            className={`flex cursor-pointer items-center justify-center self-end whitespace-nowrap rounded-lg border-2 border-dashed px-4 py-2.5 text-sm ${
              novoNome.trim() ? "border-brand text-brand hover:bg-brand-light/40" : "border-gray-300 text-gray-400"
            }`}
          >
            <input type="file" className="hidden" disabled={enviando || !novoNome.trim()} onChange={enviarArquivo} />
            {enviando ? "Enviando..." : "+ Anexar"}
          </label>
        </div>
      )}
      <p className="mt-1 text-xs text-gray-400">
        Escolha o tipo e a data de emissão: a validade é calculada pelo prazo padrão do tipo (ajustável). Ao renovar um documento, anexe o novo
        do mesmo tipo — o antigo fica guardado e deixa de contar como pendência. PDF, Word, Excel ou imagem — até 20 MB, até {LIMITE_ANEXOS}{" "}
        documentos.
      </p>
    </div>
  );
}
