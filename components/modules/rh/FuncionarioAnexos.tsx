"use client";

import { Carregando } from "@/components/ui/Esqueleto";
import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import { toast } from "./toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { urlArquivo } from "@/lib/arquivos";
import SeloValidade from "@/components/ui/SeloValidade";
import FecharComEsc from "@/components/ui/FecharComEsc";
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
  // Popup "Adicionar documento" aberto.
  const [adicionando, setAdicionando] = useState(false);
  const [validadeEditada, setValidadeEditada] = useState("");
  const [tipoEditado, setTipoEditado] = useState("");
  const [emissaoEditada, setEmissaoEditada] = useState("");
  const tipoPorId = (id: string | null | undefined) => tiposDocumento.find((t) => t.id === id);

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
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-montserrat text-xs font-bold uppercase text-brand">
          <Paperclip className="icone" aria-hidden /> Documentos do Funcionário ({anexos.length}/{LIMITE_ANEXOS})
        </h3>
        {anexos.length < LIMITE_ANEXOS && (
          <button type="button" className="btn-primary" onClick={() => setAdicionando(true)}>
            + Adicionar documento
          </button>
        )}
      </div>

      {carregando ? (
        <Carregando />
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

      <p className="mt-3 text-xs text-gray-400">
        Ao renovar um documento (novo ASO, nova NR), adicione o novo do mesmo tipo — o antigo fica guardado e deixa de contar como pendência.
      </p>

      {adicionando && (
        <ModalAdicionarDocumentoFuncionario
          funcionarioId={funcionarioId}
          tiposDocumento={tiposDocumento}
          onFechar={() => setAdicionando(false)}
          onSalvo={(novo) => {
            setAnexos((prev) => [novo, ...prev]);
            setAdicionando(false);
          }}
        />
      )}
    </div>
  );
}

/** Popup "Adicionar documento" do funcionário: tipo, nome, emissão, validade
 * e arquivo; só "Adicionar" envia — antes o arquivo subia no instante em que
 * era escolhido. */
function ModalAdicionarDocumentoFuncionario({
  funcionarioId,
  tiposDocumento,
  onFechar,
  onSalvo,
}: {
  funcionarioId: string;
  tiposDocumento: TipoDocumentoRh[];
  onFechar: () => void;
  onSalvo: (anexo: FuncionarioAnexo) => void;
}) {
  const [tipoId, setTipoId] = useState("");
  const [nome, setNome] = useState("");
  const [emissao, setEmissao] = useState("");
  const [validade, setValidade] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const tipo = tiposDocumento.find((t) => t.id === tipoId);

  // Escolher o tipo preenche o nome; emissão + tipo preenchem a validade.
  function escolherTipo(id: string) {
    setTipoId(id);
    const escolhido = tiposDocumento.find((t) => t.id === id);
    if (escolhido) setNome(escolhido.nome);
    const calculada = validadePadrao(escolhido, emissao);
    if (calculada) setValidade(calculada);
  }
  function mudarEmissao(data: string) {
    setEmissao(data);
    const calculada = validadePadrao(tipo, data);
    if (calculada) setValidade(calculada);
  }

  function escolherArquivo(event: ChangeEvent<HTMLInputElement>) {
    const escolhido = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (escolhido && escolhido.size > LIMITE_BYTES) return setErro("Arquivo maior que 20 MB — escolha um arquivo menor.");
    setErro(null);
    setArquivo(escolhido);
  }

  async function adicionar() {
    if (!nome.trim()) return setErro("Informe o nome do documento.");
    if (!arquivo) return setErro("Escolha o arquivo do documento.");
    setErro(null);
    setEnviando(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const caminho = `${funcionarioId}/${Date.now()}-${arquivo.name}`;
      const { error: erroUpload } = await supabase.storage.from(BUCKET).upload(caminho, arquivo);
      if (erroUpload) return setErro(`Erro ao enviar arquivo: ${erroUpload.message}`);
      const { data: publicUrl } = supabase.storage.from(BUCKET).getPublicUrl(caminho);

      const payload = await fetch(`/api/rh/funcionarios/${funcionarioId}/anexos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: nome.trim(),
          validade: validade || null,
          tipo_id: tipoId || null,
          data_emissao: emissao || null,
          nome_arquivo: arquivo.name,
          tipo_arquivo: extensao(arquivo.name),
          tamanho_bytes: arquivo.size,
          storage_path: caminho,
          url: publicUrl.publicUrl,
        }),
      }).then((r) => r.json());
      if (!payload.success) {
        await supabase.storage.from(BUCKET).remove([caminho]).catch(() => undefined);
        return setErro(payload.error ?? "Não foi possível salvar o documento.");
      }
      toast.sucesso("Documento adicionado.");
      onSalvo(payload.data);
    } catch (error) {
      setErro(error instanceof Error ? `Erro ao enviar arquivo: ${error.message}` : "Erro ao enviar arquivo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="modal-fundo z-50">
      <FecharComEsc onFechar={onFechar} />
      <div role="dialog" aria-modal="true" aria-labelledby="titulo-add-doc-func" className="modal-caixa sm:max-w-2xl">
        <h2 id="titulo-add-doc-func" className="mb-4 font-montserrat text-lg font-bold text-brand">
          Adicionar documento
        </h2>
        <div className="space-y-3">
          <div>
            <label className="label-field">Tipo</label>
            <select className="input-field" aria-label="Tipo do documento" value={tipoId} onChange={(e) => escolherTipo(e.target.value)}>
              <option value="">Outro (sem tipo)</option>
              {tiposDocumento.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-field">
              Nome<span className="text-status-error"> *</span>
            </label>
            <input className="input-field" placeholder='Ex.: "ASO", "NR-35"...' value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label-field">Emissão</label>
              <input type="date" aria-label="Data de emissão" className="input-field" value={emissao} onChange={(e) => mudarEmissao(e.target.value)} />
            </div>
            <div>
              <label className="label-field">Validade</label>
              <input type="date" aria-label="Validade do documento" className="input-field" value={validade} onChange={(e) => setValidade(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-gray-500">
            {tipo?.validade_meses
              ? `A validade é preenchida com a emissão + ${tipo.validade_meses} ${tipo.validade_meses === 1 ? "mês" : "meses"} (prazo padrão do tipo). Se o documento traz outra data, troque aqui — vale a data deste campo.`
              : "Informe a validade que consta no documento; em branco, o documento não vence."}
          </p>
          <div>
            <label className="label-field">
              Arquivo<span className="text-status-error"> *</span>
            </label>
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border-2 border-dashed border-brand px-4 py-3 text-sm text-brand hover:bg-brand-light/40">
              <input type="file" className="hidden" disabled={enviando} onChange={escolherArquivo} />
              <span className="truncate">{arquivo ? arquivo.name : "Escolher arquivo..."}</span>
              <span className="shrink-0 text-xs text-gray-500">{arquivo ? "trocar" : "PDF, Word, Excel ou imagem — até 20 MB"}</span>
            </label>
          </div>
          {erro && <p className="text-sm text-status-error">{erro}</p>}
          <div className="rodape-modal flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={onFechar} disabled={enviando}>
              Cancelar
            </button>
            <button type="button" className="btn-primary" onClick={adicionar} disabled={enviando}>
              {enviando ? "Enviando..." : "Adicionar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
