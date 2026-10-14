"use client";

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";
import { Download, Eye, History, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "@/components/modules/rh/toast";
import { useConfigRh } from "@/components/modules/rh/useConfigRh";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { urlArquivo } from "@/lib/arquivos";
import SeloValidade from "@/components/ui/SeloValidade";
import FecharComEsc from "@/components/ui/FecharComEsc";
import { formatarData } from "@/lib/format";
import { hojeBrasilia } from "@/lib/financeiro";
import {
  CATEGORIAS_DOCUMENTO_EMPRESA,
  LABEL_CATEGORIA_DOCUMENTO,
  checklistObrigatorios,
  validadePadrao,
  type CategoriaDocumentoEmpresa,
  type DocumentoObrigatorioEmpresa,
} from "@/lib/rh";
import type { DocumentoEmpresa } from "@/lib/types/domain";
import { confirmar } from "@/components/ui/confirmar";
import IconeArquivo from "@/components/ui/IconeArquivo";

const BUCKET = "rh-empresa-anexos";
const LIMITE_BYTES = 20 * 1024 * 1024; // 20 MB

const CLASSE_SITUACAO: Record<string, string> = {
  em_dia: "bg-accent-light text-accent-dark",
  vencendo: "bg-secondary-light text-brand",
  vencido: "bg-red-100 text-status-error",
  faltando: "bg-gray-100 text-gray-600",
};
const LABEL_SITUACAO: Record<string, string> = { em_dia: "Em dia", vencendo: "Vencendo", vencido: "Vencido", faltando: "Falta enviar" };

/** Formulário de envio: novo documento, documento de um item obrigatório
 * ou renovação (nova versão) de um documento existente. */
interface Envio {
  nome: string;
  categoria: CategoriaDocumentoEmpresa | "";
  tipo_id: string;
  emissao: string;
  validade: string;
  /** Renovação: o documento que esta versão substitui. */
  substitui: DocumentoEmpresa | null;
}
const ENVIO_VAZIO: Envio = { nome: "", categoria: "", tipo_id: "", emissao: "", validade: "", substitui: null };

/** Aba "Empresa" do módulo RH (migração 033, reorganizada na 052):
 *
 *   1. Checklist dos documentos obrigatórios (lista de RH → Configurações):
 *      em dia, vencendo, vencido ou falta enviar — com o botão de enviar ou
 *      renovar ao lado de cada um;
 *   2. Todos os documentos, agrupados por categoria;
 *   3. Renovar um documento guarda a versão anterior como histórico (ícone de
 *      relógio), em vez de substituir o arquivo ou duplicar a linha. */
export default function RhEmpresaPage() {
  const { config } = useConfigRh();
  const [documentos, setDocumentos] = useState<DocumentoEmpresa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [envio, setEnvio] = useState<Envio>(ENVIO_VAZIO);
  const [enviando, setEnviando] = useState(false);
  const [editando, setEditando] = useState<DocumentoEmpresa | null>(null);
  const [versoesDe, setVersoesDe] = useState<DocumentoEmpresa | null>(null);
  const hoje = hojeBrasilia();
  const diasAviso = config?.diasAviso ?? 30;

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const payload = await fetch("/api/rh/documentos").then((r) => r.json());
      if (payload.success) setDocumentos(payload.data);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const obrigatorioPorId = (id: string | null | undefined) => config?.obrigatorios.find((o) => o.id === id);
  const checklist = useMemo(() => (config ? checklistObrigatorios(config.obrigatorios, documentos, hoje, diasAviso) : []), [config, documentos, hoje, diasAviso]);
  const pendentes = checklist.filter((c) => c.situacao !== "em_dia").length;

  function prepararEnvio(dados: Partial<Envio>) {
    setEnvio({ ...ENVIO_VAZIO, ...dados });
    document.getElementById("envio-documento")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function enviarObrigatorio(o: DocumentoObrigatorioEmpresa, atual: DocumentoEmpresa | null) {
    prepararEnvio({ nome: o.nome, categoria: o.categoria, tipo_id: o.id, substitui: atual, emissao: hoje, validade: validadePadrao(o, hoje) ?? "" });
  }

  function mudarEmissao(data: string) {
    setEnvio((e) => ({ ...e, emissao: data, validade: validadePadrao(obrigatorioPorId(e.tipo_id), data) ?? e.validade }));
  }

  async function enviarArquivo(event: ChangeEvent<HTMLInputElement>) {
    const arquivo = event.target.files?.[0];
    event.target.value = "";
    if (!arquivo) return;
    if (!envio.nome.trim()) return toast.erro("Informe o nome do documento antes de anexar o arquivo.");
    if (arquivo.size > LIMITE_BYTES) return toast.erro("Arquivo maior que 20 MB — escolha um arquivo menor.");

    setEnviando(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const caminho = `${Date.now()}-${arquivo.name}`;
      const { error: erroUpload } = await supabase.storage.from(BUCKET).upload(caminho, arquivo);
      if (erroUpload) return toast.erro(`Erro ao enviar arquivo: ${erroUpload.message}`);
      const { data: publicUrl } = supabase.storage.from(BUCKET).getPublicUrl(caminho);

      const payload = await fetch("/api/rh/documentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: envio.nome.trim(),
          validade: envio.validade || null,
          categoria: envio.categoria || null,
          tipo_id: envio.tipo_id || null,
          substitui_id: envio.substitui?.id ?? null,
          nome_arquivo: arquivo.name,
          tipo_arquivo: arquivo.name.split(".").pop()?.toLowerCase() ?? "",
          tamanho_bytes: arquivo.size,
          storage_path: caminho,
          url: publicUrl.publicUrl,
        }),
      }).then((r) => r.json());
      if (!payload.success) return toast.erro(payload.error ?? "Não foi possível salvar o documento.");

      toast.sucesso(envio.substitui ? "Documento renovado — a versão anterior ficou no histórico." : "Documento adicionado.");
      setEnvio(ENVIO_VAZIO);
      carregar();
    } catch (error) {
      toast.erro(error instanceof Error ? `Erro ao enviar arquivo: ${error.message}` : "Erro ao enviar arquivo.");
    } finally {
      setEnviando(false);
    }
  }

  async function remover(documento: DocumentoEmpresa) {
    const temAnterior = (documento.versoes_anteriores ?? 0) > 0;
    if (!(await confirmar(`Excluir o documento "${documento.nome}"?${temAnterior ? " Só esta versão é excluída: a versão anterior volta a ser a atual." : ""}`))) return;
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.storage.from(BUCKET).remove([documento.storage_path]).catch(() => undefined);
      const payload = await fetch(`/api/rh/documentos/${documento.id}`, { method: "DELETE" }).then((r) => r.json());
      if (!payload.success) return toast.erro(payload.error ?? "Não foi possível excluir o documento.");
      toast.sucesso("Documento excluído.");
      carregar();
    } catch {
      toast.erro("Erro de conexão ao excluir o documento.");
    }
  }

  // Documentos por categoria (sem categoria = "Outros").
  const porCategoria = CATEGORIAS_DOCUMENTO_EMPRESA.map((c) => ({
    categoria: c,
    docs: documentos.filter((d) => ((d.categoria as CategoriaDocumentoEmpresa | null) ?? "outros") === c || (c === "outros" && !CATEGORIAS_DOCUMENTO_EMPRESA.includes(d.categoria as CategoriaDocumentoEmpresa))),
  })).filter((g) => g.docs.length > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Documentos da Empresa</h1>
        <p className="text-sm text-gray-500">
          Checklist do que a empresa precisa ter em dia e todos os documentos por categoria. A lista de obrigatórios e os prazos ficam em
          RH → Configurações.
        </p>
      </div>

      {/* 1. Checklist de obrigatórios */}
      {config && config.obrigatorios.length > 0 && (
        <section className="card space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">Documentos obrigatórios</h2>
            <span className={`text-sm ${pendentes > 0 ? "font-semibold text-status-error" : "text-accent-dark"}`}>
              {pendentes === 0 ? "Tudo em dia" : `${pendentes} ${pendentes === 1 ? "pendência" : "pendências"}`}
            </span>
          </div>
          {CATEGORIAS_DOCUMENTO_EMPRESA.map((categoria) => {
            const itens = checklist.filter((c) => c.obrigatorio.categoria === categoria);
            if (itens.length === 0) return null;
            return (
              <div key={categoria}>
                <p className="mb-1 text-xs font-semibold uppercase text-gray-500">{LABEL_CATEGORIA_DOCUMENTO[categoria]}</p>
                <ul className="divide-y divide-gray-100 rounded-card border border-gray-200">
                  {itens.map(({ obrigatorio, documento, situacao }) => (
                    <li key={obrigatorio.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className={`badge ${CLASSE_SITUACAO[situacao]}`}>{LABEL_SITUACAO[situacao]}</span>
                        <span className="font-medium text-gray-800">{obrigatorio.nome}</span>
                        {documento?.validade && <span className="text-xs text-gray-500">até {formatarData(documento.validade)}</span>}
                      </span>
                      <span className="flex items-center gap-3 text-xs">
                        {documento && (
                          <a href={urlArquivo(documento.url)} target="_blank" rel="noreferrer" className="text-brand hover:underline">
                            <Eye className="icone" aria-hidden /> Ver
                          </a>
                        )}
                        <button type="button" className="font-semibold text-brand hover:underline" onClick={() => enviarObrigatorio(obrigatorio, documento)}>
                          {documento ? (
                            <>
                              <RefreshCw className="icone" aria-hidden /> Renovar
                            </>
                          ) : (
                            "+ Enviar"
                          )}
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </section>
      )}

      {/* 2. Envio */}
      <section id="envio-documento" className="card space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">{envio.substitui ? `Renovar: ${envio.substitui.nome}` : "Enviar documento"}</h2>
          {(envio.substitui || envio.tipo_id) && (
            <button type="button" className="text-xs text-gray-500 hover:underline" onClick={() => setEnvio(ENVIO_VAZIO)}>
              Cancelar
            </button>
          )}
        </div>
        {envio.substitui && <p className="text-xs text-gray-500">A versão atual vai para o histórico deste documento — nada é apagado.</p>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1.2fr_1.4fr_auto_auto_auto] lg:items-end">
          <div>
            <label className="label-field">Nome do documento</label>
            <input className="input-field" placeholder='Ex.: "Contrato Social", "PGR 2026"...' value={envio.nome} onChange={(e) => setEnvio((x) => ({ ...x, nome: e.target.value }))} />
          </div>
          <div>
            <label className="label-field">Categoria</label>
            <select className="input-field" value={envio.categoria} onChange={(e) => setEnvio((x) => ({ ...x, categoria: e.target.value as CategoriaDocumentoEmpresa | "" }))}>
              <option value="">Outros</option>
              {CATEGORIAS_DOCUMENTO_EMPRESA.filter((c) => c !== "outros").map((c) => (
                <option key={c} value={c}>
                  {LABEL_CATEGORIA_DOCUMENTO[c]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-field">Cumpre o obrigatório</label>
            <select
              className="input-field"
              value={envio.tipo_id}
              onChange={(e) => {
                const o = obrigatorioPorId(e.target.value);
                setEnvio((x) => ({ ...x, tipo_id: e.target.value, categoria: o?.categoria ?? x.categoria, nome: x.nome || o?.nome || "", validade: validadePadrao(o, x.emissao) ?? x.validade }));
              }}
            >
              <option value="">Nenhum</option>
              {(config?.obrigatorios ?? []).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-field">Emissão</label>
            <input type="date" className="input-field" value={envio.emissao} onChange={(e) => mudarEmissao(e.target.value)} />
          </div>
          <div>
            <label className="label-field">Validade</label>
            <input type="date" className="input-field" value={envio.validade} onChange={(e) => setEnvio((x) => ({ ...x, validade: e.target.value }))} />
          </div>
          <label
            className={`flex cursor-pointer items-center justify-center whitespace-nowrap rounded-lg border-2 border-dashed p-2 px-4 text-sm ${
              envio.nome.trim() ? "border-brand text-brand hover:bg-brand-light/40" : "border-gray-300 text-gray-400"
            }`}
          >
            <input type="file" className="hidden" disabled={enviando || !envio.nome.trim()} onChange={enviarArquivo} />
            {enviando ? "Enviando..." : "+ Anexar arquivo"}
          </label>
        </div>
        <p className="text-xs text-gray-400">
          Ligando a um obrigatório, a validade é calculada pelo prazo dele a partir da emissão (ajustável). PDF, Word, Excel ou imagem — até 20
          MB.
        </p>
      </section>

      {/* 3. Todos os documentos por categoria */}
      {carregando ? (
        <p className="text-sm text-gray-500">Carregando...</p>
      ) : documentos.length === 0 ? (
        <p className="text-sm text-gray-400">Nenhum documento cadastrado ainda.</p>
      ) : (
        porCategoria.map(({ categoria, docs }) => (
          <section key={categoria} className="card overflow-x-auto p-0">
            <h2 className="px-4 pt-4 text-lg font-semibold">{LABEL_CATEGORIA_DOCUMENTO[categoria]}</h2>
            <table className="tabela-cartoes mt-2 w-full text-sm">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-2 text-left">Documento</th>
                  <th className="px-4 py-2 text-left">Arquivo</th>
                  <th className="px-4 py-2 text-left">Validade</th>
                  <th className="px-4 py-2 text-left">Adicionado em</th>
                  <th className="px-4 py-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {docs.map((documento) => (
                  <tr key={documento.id}>
                    <td data-label="Documento" className="px-4 py-2 font-medium text-brand">
                      {documento.nome}
                      {obrigatorioPorId(documento.tipo_id) && <span className="badge ml-2 bg-brand-light text-brand">Obrigatório</span>}
                    </td>
                    <td data-label="Arquivo" className="px-4 py-2 text-gray-500">
                      <IconeArquivo tipo={documento.tipo_arquivo} className="mr-1 inline h-4 w-4 align-[-3px] text-brand" />
                      {documento.nome_arquivo}
                    </td>
                    <td data-label="Validade" className="px-4 py-2 text-gray-600">
                      <SeloValidade validade={documento.validade} diasAviso={diasAviso} />
                    </td>
                    <td data-label="Adicionado em" className="px-4 py-2 text-gray-500">{formatarData(documento.data_adicao)}</td>
                    <td data-label="Ações" className="px-4 py-2">
                      <div className="flex items-center justify-end gap-3 text-xs">
                        <a href={urlArquivo(documento.url)} target="_blank" rel="noreferrer" className="text-brand hover:underline" title="Ver">
                          <Eye className="icone" aria-hidden />
                        </a>
                        <a href={urlArquivo(documento.url, { baixarComo: documento.nome_arquivo })} className="text-brand hover:underline" title="Baixar">
                          <Download className="icone" aria-hidden />
                        </a>
                        <button
                          type="button"
                          className="text-brand hover:underline"
                          title="Renovar (enviar nova versão)"
                          aria-label="Renovar"
                          onClick={() =>
                            prepararEnvio({
                              nome: documento.nome,
                              categoria: (documento.categoria as CategoriaDocumentoEmpresa) ?? "",
                              tipo_id: documento.tipo_id ?? "",
                              substitui: documento,
                              emissao: hoje,
                              validade: validadePadrao(obrigatorioPorId(documento.tipo_id), hoje) ?? "",
                            })
                          }
                        >
                          <RefreshCw className="icone" aria-hidden />
                        </button>
                        {(documento.versoes_anteriores ?? 0) > 0 && (
                          <button type="button" className="text-brand hover:underline" title="Versões anteriores" aria-label="Versões anteriores" onClick={() => setVersoesDe(documento)}>
                            <History className="icone" aria-hidden /> {documento.versoes_anteriores}
                          </button>
                        )}
                        <button type="button" className="hover:opacity-70" title="Editar" aria-label="Editar" onClick={() => setEditando(documento)}>
                          <Pencil className="icone" aria-hidden />
                        </button>
                        <button type="button" className="text-status-error hover:underline" title="Excluir" aria-label="Excluir" onClick={() => remover(documento)}>
                          <Trash2 className="icone" aria-hidden />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))
      )}

      {editando && (
        <ModalEditarDocumento
          documento={editando}
          obrigatorios={config?.obrigatorios ?? []}
          onFechar={() => setEditando(null)}
          onSalvo={() => {
            setEditando(null);
            carregar();
          }}
        />
      )}
      {versoesDe && <ModalVersoes documento={versoesDe} diasAviso={diasAviso} onFechar={() => setVersoesDe(null)} />}
    </div>
  );
}

function ModalEditarDocumento({
  documento,
  obrigatorios,
  onFechar,
  onSalvo,
}: {
  documento: DocumentoEmpresa;
  obrigatorios: DocumentoObrigatorioEmpresa[];
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [nome, setNome] = useState(documento.nome);
  const [categoria, setCategoria] = useState(documento.categoria ?? "");
  const [tipoId, setTipoId] = useState(documento.tipo_id ?? "");
  const [validade, setValidade] = useState(documento.validade ?? "");
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!nome.trim()) return toast.erro("Informe o nome do documento.");
    setSalvando(true);
    try {
      const r = await fetch(`/api/rh/documentos/${documento.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: nome.trim(), categoria: categoria || null, tipo_id: tipoId || null, validade: validade || null }),
      }).then((x) => x.json());
      if (!r.success) return toast.erro(r.error ?? "Não foi possível salvar.");
      toast.sucesso("Documento atualizado.");
      onSalvo();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand/60 p-4">
      <FecharComEsc onFechar={onFechar} />
      <div role="dialog" aria-modal="true" aria-labelledby="titulo-editar-doc" className="w-full max-w-md rounded-card bg-white p-6 shadow-card-hover">
        <h2 id="titulo-editar-doc" className="mb-4 font-montserrat text-lg font-bold text-brand">
          Editar documento
        </h2>
        <div className="space-y-3">
          <div>
            <label className="label-field">Nome</label>
            <input className="input-field" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div>
            <label className="label-field">Categoria</label>
            <select className="input-field" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              <option value="">Outros</option>
              {CATEGORIAS_DOCUMENTO_EMPRESA.filter((c) => c !== "outros").map((c) => (
                <option key={c} value={c}>
                  {LABEL_CATEGORIA_DOCUMENTO[c]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-field">Cumpre o obrigatório</label>
            <select className="input-field" value={tipoId} onChange={(e) => setTipoId(e.target.value)}>
              <option value="">Nenhum</option>
              {obrigatorios.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-field">Validade</label>
            <input type="date" className="input-field" value={validade} onChange={(e) => setValidade(e.target.value)} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={onFechar}>
              Cancelar
            </button>
            <button type="button" className="btn-primary" onClick={salvar} disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModalVersoes({ documento, diasAviso, onFechar }: { documento: DocumentoEmpresa; diasAviso: number; onFechar: () => void }) {
  const [versoes, setVersoes] = useState<DocumentoEmpresa[] | null>(null);

  useEffect(() => {
    fetch(`/api/rh/documentos/${documento.id}/versoes`)
      .then((x) => x.json())
      .then((r) => setVersoes(r?.success ? r.data : []))
      .catch(() => setVersoes([]));
  }, [documento.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand/60 p-4">
      <FecharComEsc onFechar={onFechar} />
      <div role="dialog" aria-modal="true" aria-labelledby="titulo-versoes" className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-card bg-white p-6 shadow-card-hover">
        <h2 id="titulo-versoes" className="mb-1 font-montserrat text-lg font-bold text-brand">
          Versões de {documento.nome}
        </h2>
        <p className="mb-4 text-xs text-gray-500">Da mais nova para a mais antiga. Só a atual conta no checklist e nos alertas.</p>
        {!versoes ? (
          <p className="text-sm text-gray-500">Carregando...</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {versoes.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span className="min-w-0">
                  <span className="font-medium text-gray-800">{v.nome_arquivo}</span>
                  {!v.arquivado_em && <span className="badge ml-2 bg-accent-light text-accent-dark">Atual</span>}
                  <span className="block text-xs text-gray-500">
                    Enviado em {formatarData(v.data_adicao)}
                    {v.arquivado_em ? ` · substituído em ${formatarData(v.arquivado_em)}` : ""} · validade{" "}
                    {v.validade ? <SeloValidade validade={v.validade} diasAviso={v.arquivado_em ? -1 : diasAviso} /> : "não vence"}
                  </span>
                </span>
                <a href={urlArquivo(v.url)} target="_blank" rel="noreferrer" className="text-xs text-brand hover:underline">
                  <Eye className="icone" aria-hidden /> Ver
                </a>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex justify-end">
          <button type="button" className="btn-secondary" onClick={onFechar}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
