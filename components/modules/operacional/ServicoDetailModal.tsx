"use client";

import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import { toast } from "./toast";
import ModalAdicionarParceiroServico from "./ModalAdicionarParceiroServico";
import { TIPOS_TRABALHO_OPCOES } from "./MultiSelectTiposTrabalho";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatarDataHora, formatarMoeda } from "@/lib/format";
import type { HistoricoServico, InteracaoServico, Servico, ServicoParceiroExecucao, TipoInteracaoServico } from "@/lib/types/domain";

const BUCKET = "servicos-anexos";
const LIMITE_FOTOS = 20;

// Lista revisada (migração 027) — reaproveita a mesma fonte de sempre, ver
// MultiSelectTiposTrabalho.tsx.
const LABEL_TIPO_TRABALHO: Record<string, string> = Object.fromEntries(TIPOS_TRABALHO_OPCOES.map((o) => [o.valor, o.label]));
const LABEL_ETAPA: Record<string, string> = { planejamento: "Planejamento", execucao: "Execução", finalizado: "Finalizado" };
const TIPOS_INTERACAO: TipoInteracaoServico[] = ["nota", "foto", "chamada", "email", "reuniao"];
const LABEL_TIPO_INTERACAO: Record<TipoInteracaoServico, string> = {
  nota: "Nota",
  foto: "Foto",
  chamada: "Ligação",
  email: "E-mail",
  reuniao: "Reunião",
};

type AbaInterna = "dados" | "timeline" | "interacoes";

interface Props {
  servicoId: string;
  onFechar: () => void;
  onServicoMudou: () => void;
}

function descreverEvento(h: HistoricoServico): string {
  switch (h.tipo_evento) {
    case "criacao":
      return h.descricao ?? "Serviço criado.";
    case "mudanca_etapa":
      return `Movido de ${h.etapa_anterior ? LABEL_ETAPA[h.etapa_anterior] : "—"} para ${h.etapa_nova ? LABEL_ETAPA[h.etapa_nova] : "—"}`;
    case "anexo_adicionado":
      return h.descricao ?? "Anexo adicionado.";
    case "finalizacao":
      return h.descricao ?? "Serviço finalizado.";
    default:
      return h.tipo_evento;
  }
}

export default function ServicoDetailModal({ servicoId, onFechar, onServicoMudou }: Props) {
  const [aba, setAba] = useState<AbaInterna>("dados");
  const [servico, setServico] = useState<Servico | null>(null);
  const [historico, setHistorico] = useState<HistoricoServico[]>([]);
  const [interacoes, setInteracoes] = useState<InteracaoServico[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [notas, setNotas] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFimPrevista, setDataFimPrevista] = useState("");
  const [responsavelEmail, setResponsavelEmail] = useState("");
  const [usuarios, setUsuarios] = useState<Array<{ email: string; nome: string }>>([]);
  const [salvandoDados, setSalvandoDados] = useState(false);

  const [finalizando, setFinalizando] = useState(false);
  const [enviandoArquivo, setEnviandoArquivo] = useState<string | null>(null);

  const [mostrarAdicionarParceiro, setMostrarAdicionarParceiro] = useState(false);
  const [removendoParceiroId, setRemovendoParceiroId] = useState<string | null>(null);

  const [novaInteracaoTipo, setNovaInteracaoTipo] = useState<TipoInteracaoServico>("nota");
  const [novaInteracaoDescricao, setNovaInteracaoDescricao] = useState("");
  const [salvandoInteracao, setSalvandoInteracao] = useState(false);

  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/usuarios")
      .then((r) => r.json())
      .then(setUsuarios)
      .catch(() => setUsuarios([]));
  }, []);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [respServico, respHistorico, respInteracoes] = await Promise.all([
        fetch(`/api/operacional/servicos/${servicoId}`),
        fetch(`/api/operacional/servicos/${servicoId}/historico`),
        fetch(`/api/operacional/servicos/${servicoId}/interacoes`),
      ]);
      const [payloadServico, payloadHistorico, payloadInteracoes] = await Promise.all([
        respServico.json(),
        respHistorico.json(),
        respInteracoes.json(),
      ]);

      if (payloadServico.success) {
        const s: Servico = payloadServico.data;
        setServico(s);
        setNotas(s.notas ?? "");
        setDataInicio(s.data_inicio ?? "");
        setDataFimPrevista(s.data_fim_prevista ?? "");
        setResponsavelEmail(s.responsavel_email ?? "");
      } else {
        setErro(payloadServico.error ?? "Erro ao carregar o serviço.");
      }
      if (payloadHistorico.success) setHistorico(payloadHistorico.data);
      if (payloadInteracoes.success) setInteracoes(payloadInteracoes.data);
    } catch {
      setErro("Erro de conexão ao carregar o serviço.");
    } finally {
      setCarregando(false);
    }
  }, [servicoId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function salvarDados() {
    setSalvandoDados(true);
    try {
      const response = await fetch(`/api/operacional/servicos/${servicoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notas: notas || null,
          data_inicio: dataInicio || undefined,
          data_fim_prevista: dataFimPrevista || null,
          responsavel_email: responsavelEmail || undefined,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        toast.erro(payload.error ?? "Não foi possível salvar os dados do serviço.");
        return;
      }
      toast.sucesso("Dados do serviço atualizados.");
      setServico(payload.data);
      onServicoMudou();
    } finally {
      setSalvandoDados(false);
    }
  }

  async function adicionarParceiro(_execucao: ServicoParceiroExecucao) {
    setMostrarAdicionarParceiro(false);
    await carregar();
    onServicoMudou();
  }

  async function removerParceiro(execucaoId: string) {
    if (!confirm("Remover este parceiro do serviço?")) return;
    setRemovendoParceiroId(execucaoId);
    try {
      const response = await fetch(`/api/operacional/servicos/${servicoId}/parceiros/${execucaoId}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        toast.erro(payload.error ?? "Não foi possível remover o parceiro.");
        return;
      }
      toast.sucesso("Parceiro removido do serviço.");
      await carregar();
      onServicoMudou();
    } finally {
      setRemovendoParceiroId(null);
    }
  }

  /** Nome legível a partir da URL pública do Storage — o caminho é
   * `${numero_servico}/${Date.now()}-${nome_original}` (ver enviarArquivo
   * abaixo), então tirar o prefixo numérico devolve o nome original que o
   * usuário reconhece. Não há tamanho (bytes) persistido em lugar nenhum —
   * só a URL final é gravada no serviço, o File.size do navegador nunca foi
   * salvo — por isso a UI não mostra tamanho, só o nome do arquivo. */
  function nomeArquivo(url: string): string {
    const ultimoSegmento = decodeURIComponent(url.split("/").pop() ?? "");
    return ultimoSegmento.replace(/^\d+-/, "") || ultimoSegmento;
  }

  function caminhoStorage(url: string): string | null {
    const marcador = `/${BUCKET}/`;
    const indice = url.indexOf(marcador);
    return indice === -1 ? null : decodeURIComponent(url.slice(indice + marcador.length));
  }

  async function enviarArquivo(event: ChangeEvent<HTMLInputElement>, campo: "foto_principal_url" | "pdf_relatorio_url" | "fotos_url") {
    const arquivo = event.target.files?.[0];
    if (!arquivo || !servico) return;

    setEnviandoArquivo(campo);
    try {
      const supabase = createSupabaseBrowserClient();
      const caminho = `${servico.numero_servico}/${Date.now()}-${arquivo.name}`;

      const { error: erroUpload } = await supabase.storage.from(BUCKET).upload(caminho, arquivo);
      if (erroUpload) {
        toast.erro(`Erro ao enviar arquivo: ${erroUpload.message}`);
        return;
      }

      const { data: publicUrl } = supabase.storage.from(BUCKET).getPublicUrl(caminho);

      const response = await fetch(`/api/operacional/servicos/${servicoId}/anexar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campo, url: publicUrl.publicUrl }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        toast.erro(payload.error ?? "Não foi possível salvar o anexo.");
        return;
      }

      toast.sucesso("Arquivo anexado.");
      setServico(payload.data);
      onServicoMudou();
    } finally {
      setEnviandoArquivo(null);
      event.target.value = "";
    }
  }

  async function removerArquivo(campo: "foto_principal_url" | "pdf_relatorio_url" | "fotos_url", url: string) {
    if (!confirm("Remover este anexo?")) return;
    setEnviandoArquivo(campo);
    try {
      const caminho = caminhoStorage(url);
      if (caminho) {
        const supabase = createSupabaseBrowserClient();
        // Melhor esforço — se o arquivo já não existir no Storage por algum
        // motivo, não bloqueia a remoção da referência no serviço.
        await supabase.storage.from(BUCKET).remove([caminho]).catch(() => undefined);
      }

      const response = await fetch(`/api/operacional/servicos/${servicoId}/anexar`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campo, url }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        toast.erro(payload.error ?? "Não foi possível remover o anexo.");
        return;
      }

      toast.sucesso("Anexo removido.");
      setServico(payload.data);
      onServicoMudou();
    } finally {
      setEnviandoArquivo(null);
    }
  }

  async function confirmarFinalizacao() {
    setFinalizando(true);
    try {
      const response = await fetch(`/api/operacional/servicos/${servicoId}/finalizar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        toast.erro(payload.error ?? "Não foi possível finalizar o serviço.");
        return;
      }
      toast.sucesso("Serviço finalizado!");
      await carregar();
      onServicoMudou();
    } finally {
      setFinalizando(false);
    }
  }

  async function excluir() {
    if (!confirm("Excluir este serviço? Esta ação não pode ser desfeita.")) return;
    const response = await fetch(`/api/operacional/servicos/${servicoId}`, { method: "DELETE" });
    if (response.ok) {
      toast.sucesso("Serviço excluído.");
      onServicoMudou();
      onFechar();
    } else {
      toast.erro("Não foi possível excluir o serviço.");
    }
  }

  async function adicionarInteracao() {
    if (!novaInteracaoDescricao.trim()) return;
    setSalvandoInteracao(true);
    try {
      const response = await fetch(`/api/operacional/servicos/${servicoId}/interacoes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: novaInteracaoTipo, descricao: novaInteracaoDescricao }),
      });
      const payload = await response.json();
      if (response.ok && payload.success) {
        setNovaInteracaoDescricao("");
        setInteracoes((prev) => [payload.data, ...prev]);
        toast.sucesso("Interação registrada.");
      } else {
        toast.erro(payload.error ?? "Não foi possível registrar a interação.");
      }
    } finally {
      setSalvandoInteracao(false);
    }
  }

  const temFotos = (servico?.fotos_url.length ?? 0) > 0;
  const temPdf = !!servico?.pdf_relatorio_url;
  const podeFinalizar = temFotos && temPdf;

  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-brand/60" onClick={onFechar}>
      <div className="flex h-full w-full max-w-xl flex-col overflow-y-auto bg-white shadow-card-hover" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-gray-100 p-4">
          <button type="button" className="text-sm text-brand hover:underline" onClick={onFechar}>
            ← Voltar
          </button>

          {servico && (
            <div className="mt-2 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-montserrat text-lg font-bold text-brand">{servico.numero_servico}</h2>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="badge bg-brand-light text-brand">{LABEL_ETAPA[servico.etapa]}</span>
                  {servico.numero_lead && <span className="text-xs text-gray-400">Lead: {servico.numero_lead}</span>}
                  {servico.numero_orcamento && <span className="text-xs text-gray-400">Orç: {servico.numero_orcamento}</span>}
                </div>
              </div>
              <button type="button" className="btn-danger shrink-0 text-xs" onClick={excluir}>
                Excluir ✕
              </button>
            </div>
          )}
        </div>

        {carregando ? (
          <p className="p-4 text-sm text-gray-500">Carregando...</p>
        ) : erro || !servico ? (
          <div className="m-4 rounded-card bg-red-50 p-4 text-sm text-status-error">
            <p>{erro ?? "Não foi possível carregar o serviço."}</p>
            <button type="button" className="btn-secondary mt-3" onClick={carregar}>
              Tentar de novo
            </button>
          </div>
        ) : (
          <>
            <div className="flex gap-1 border-b border-gray-100 px-4 pt-2">
              {(
                [
                  ["dados", "Dados"],
                  ["timeline", "Timeline"],
                  ["interacoes", `Interações (${interacoes.length})`],
                ] as [AbaInterna, string][]
              ).map(([valor, label]) => (
                <button
                  key={valor}
                  type="button"
                  onClick={() => setAba(valor)}
                  className={`rounded-t-lg px-3 py-2 text-sm font-medium transition-colors ${
                    aba === valor ? "bg-brand-light text-brand" : "text-gray-500 hover:bg-gray-50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex-1 space-y-5 p-4">
              {aba === "dados" && (
                <>
                  <div className="space-y-2 rounded-card bg-gray-50 p-3 text-sm">
                    <p>
                      <span className="text-gray-500">Cliente:</span> {servico.cliente?.nome ?? "—"}
                    </p>
                    <p>
                      <span className="text-gray-500">Tipos de trabalho:</span>{" "}
                      {(servico.tipos_trabalho ?? []).length > 0
                        ? servico.tipos_trabalho.map((t) => LABEL_TIPO_TRABALHO[t] ?? t).join(", ")
                        : "—"}
                    </p>
                    <p>
                      <span className="text-gray-500">Valor orçado:</span>{" "}
                      {servico.valor_orcado != null ? formatarMoeda(servico.valor_orcado) : "—"}
                    </p>
                    {servico.valor_real != null && (
                      <p>
                        <span className="text-gray-500">Valor real:</span> {formatarMoeda(servico.valor_real)}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="label-field">Data início</label>
                      <input type="date" className="input-field" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
                    </div>
                    <div>
                      <label className="label-field">Data fim prevista</label>
                      <input
                        type="date"
                        className="input-field"
                        value={dataFimPrevista ?? ""}
                        onChange={(e) => setDataFimPrevista(e.target.value)}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="label-field">Responsável</label>
                      <select className="input-field" value={responsavelEmail} onChange={(e) => setResponsavelEmail(e.target.value)}>
                        <option value="">Selecione...</option>
                        {usuarios.map((u) => (
                          <option key={u.email} value={u.email}>
                            {u.nome}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="label-field">Notas</label>
                    <textarea className="input-field" rows={3} value={notas} onChange={(e) => setNotas(e.target.value)} />
                  </div>
                  <button type="button" className="btn-primary" onClick={salvarDados} disabled={salvandoDados}>
                    {salvandoDados ? "Salvando..." : "Salvar"}
                  </button>

                  {/* Mudar etapa: removido daqui — Kanban (drag&drop) é a
                      ÚNICA forma de mudar etapa (pedido explícito, evita
                      redundância entre esta tela e o Kanban). */}

                  <div className="space-y-3 border-t border-gray-100 pt-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-montserrat text-xs font-bold uppercase text-brand">👥 Parceiros</h3>
                      <button type="button" className="text-xs font-semibold text-brand hover:underline" onClick={() => setMostrarAdicionarParceiro(true)}>
                        + Adicionar Parceiro
                      </button>
                    </div>
                    <div className="space-y-2">
                      {(servico.parceiros_execucao ?? []).map((execucao) => (
                        <div key={execucao.id} className="rounded-lg border border-gray-200 bg-gray-50 p-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-medium text-gray-800">
                                ✅ {execucao.parceiro?.nome ?? "—"}{" "}
                                <span className="font-normal text-gray-400">
                                  ({execucao.pessoas_mobilizadas} {execucao.pessoas_mobilizadas === 1 ? "pessoa" : "pessoas"})
                                </span>
                              </p>
                              <p className="text-xs text-gray-500">{execucao.tipos_trabalho.map((t) => LABEL_TIPO_TRABALHO[t] ?? t).join(", ")}</p>
                            </div>
                            <button
                              type="button"
                              title="Remover"
                              className="shrink-0 hover:opacity-70"
                              disabled={removendoParceiroId !== null}
                              onClick={() => removerParceiro(execucao.id)}
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      ))}
                      {(servico.parceiros_execucao ?? []).length === 0 && (
                        <p className="text-sm text-gray-400">Nenhum parceiro vinculado ainda.</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4 border-t border-gray-100 pt-4">
                    <h3 className="font-montserrat text-xs font-bold uppercase text-brand">
                      📎 Anexos {servico.etapa !== "finalizado" && "(obrigatórios para finalizar)"}
                    </h3>

                    <div className="rounded-card border border-gray-200 p-3">
                      <p className="mb-2 text-sm font-semibold text-gray-700">📸 Fotos do Projeto ({servico.fotos_url.length}/{LIMITE_FOTOS})</p>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {servico.fotos_url.map((url) => (
                          <div key={url} className="overflow-hidden rounded-lg border border-brand-light bg-brand-light/20">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={url} alt="Foto do projeto" className="h-20 w-full object-cover" />
                            <div className="flex items-center justify-between gap-1 p-1.5">
                              <span className="truncate text-[11px] text-brand" title={nomeArquivo(url)}>
                                ✅ {nomeArquivo(url)}
                              </span>
                              <div className="flex shrink-0 gap-1.5">
                                <a href={url} target="_blank" rel="noreferrer" title="Visualizar" className="hover:opacity-70">
                                  👁️
                                </a>
                                <button type="button" title="Remover" className="hover:opacity-70" disabled={enviandoArquivo !== null} onClick={() => removerArquivo("fotos_url", url)}>
                                  🗑️
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      {servico.fotos_url.length === 0 && <p className="mb-2 text-sm text-gray-400">Nenhuma foto ainda.</p>}
                      {servico.fotos_url.length < LIMITE_FOTOS && (
                        <label className="mt-2 flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-2 text-xs text-gray-500 hover:border-brand">
                          <input type="file" accept="image/*" className="hidden" disabled={enviandoArquivo !== null} onChange={(e) => enviarArquivo(e, "fotos_url")} />
                          📤 {enviandoArquivo === "fotos_url" ? "Enviando..." : "Adicionar fotos"}
                        </label>
                      )}
                    </div>

                    <div className="rounded-card border border-gray-200 p-3">
                      <p className="mb-2 text-sm font-semibold text-gray-700">📄 PDF Relatório (Obrigatório)</p>
                      {servico.pdf_relatorio_url ? (
                        <div className="flex items-center justify-between gap-3 rounded-lg border border-accent-light bg-accent-light/40 p-2">
                          <span className="truncate text-xs text-accent-dark">✅ {nomeArquivo(servico.pdf_relatorio_url)}</span>
                          <div className="flex shrink-0 gap-2">
                            <a href={servico.pdf_relatorio_url} target="_blank" rel="noreferrer" title="Visualizar" className="hover:opacity-70">
                              👁️
                            </a>
                            <label className="cursor-pointer hover:opacity-70" title="Substituir">
                              <input type="file" accept="application/pdf" className="hidden" disabled={enviandoArquivo !== null} onChange={(e) => enviarArquivo(e, "pdf_relatorio_url")} />
                              📤
                            </label>
                            <button
                              type="button"
                              title="Remover"
                              className="hover:opacity-70"
                              disabled={enviandoArquivo !== null}
                              onClick={() => removerArquivo("pdf_relatorio_url", servico.pdf_relatorio_url!)}
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      ) : (
                        <label className="flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-3 text-sm text-gray-500 hover:border-brand">
                          <input type="file" accept="application/pdf" className="hidden" disabled={enviandoArquivo !== null} onChange={(e) => enviarArquivo(e, "pdf_relatorio_url")} />
                          📤 {enviandoArquivo === "pdf_relatorio_url" ? "Enviando..." : "Escolher PDF"}
                        </label>
                      )}
                    </div>
                  </div>

                  {servico.etapa !== "finalizado" && (
                    <div className="space-y-2 rounded-card border-l-4 border-l-secondary bg-secondary-light/40 p-4">
                      <h3 className="font-montserrat text-xs font-bold uppercase text-brand">✅ Requisitos para Finalizar</h3>
                      <p className={`text-xs ${temFotos ? "text-accent-dark" : "text-gray-400"}`}>
                        {temFotos ? "✅" : "⬜"} Fotos do projeto anexadas (mín. 1)
                      </p>
                      <p className={`text-xs ${temPdf ? "text-accent-dark" : "text-gray-400"}`}>{temPdf ? "✅" : "⬜"} PDF relatório anexado</p>
                      {podeFinalizar && <p className="text-xs text-accent-dark">✅ Pronto para confirmar finalização</p>}
                      <button
                        type="button"
                        className="btn-accent"
                        onClick={confirmarFinalizacao}
                        disabled={!podeFinalizar || finalizando}
                        title={!podeFinalizar ? "Anexe fotos do projeto e o PDF relatório" : undefined}
                      >
                        {finalizando ? "Finalizando..." : "✨ Confirmar finalização"}
                      </button>
                    </div>
                  )}

                  {mostrarAdicionarParceiro && (
                    <ModalAdicionarParceiroServico
                      servicoId={servicoId}
                      onFechar={() => setMostrarAdicionarParceiro(false)}
                      onAdicionado={adicionarParceiro}
                    />
                  )}
                </>
              )}

              {aba === "timeline" && (
                <ol className="relative space-y-4 border-l-2 border-brand pl-4">
                  {historico.map((h) => (
                    <li key={h.id}>
                      <div className="absolute -ml-[21px] mt-1 h-2.5 w-2.5 rounded-full bg-brand" />
                      <p className="text-xs text-gray-400">
                        {formatarDataHora(h.data_evento)}
                        {h.usuario_email && ` · ${h.usuario_email}`}
                      </p>
                      <p className="text-sm text-gray-800">{descreverEvento(h)}</p>
                    </li>
                  ))}
                  {historico.length === 0 && <p className="text-sm text-gray-400">Sem histórico ainda.</p>}
                </ol>
              )}

              {aba === "interacoes" && (
                <div className="space-y-4">
                  <div className="flex flex-col gap-2 border-b border-gray-100 pb-4 sm:flex-row">
                    <select className="input-field sm:w-40" value={novaInteracaoTipo} onChange={(e) => setNovaInteracaoTipo(e.target.value as TipoInteracaoServico)}>
                      {TIPOS_INTERACAO.map((tipo) => (
                        <option key={tipo} value={tipo}>
                          {LABEL_TIPO_INTERACAO[tipo]}
                        </option>
                      ))}
                    </select>
                    <input
                      className="input-field flex-1"
                      placeholder="Descreva a interação..."
                      value={novaInteracaoDescricao}
                      onChange={(e) => setNovaInteracaoDescricao(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && adicionarInteracao()}
                    />
                    <button type="button" className="btn-primary" onClick={adicionarInteracao} disabled={salvandoInteracao || !novaInteracaoDescricao.trim()}>
                      Adicionar
                    </button>
                  </div>

                  <ol className="relative space-y-4 border-l-2 border-accent pl-4">
                    {interacoes.map((interacao) => (
                      <li key={interacao.id}>
                        <div className="absolute -ml-[21px] mt-1 h-2.5 w-2.5 rounded-full bg-accent" />
                        <p className="text-xs text-gray-400">
                          {LABEL_TIPO_INTERACAO[interacao.tipo]} · {formatarDataHora(interacao.data_interacao)}
                          {interacao.autor_email && ` · ${interacao.autor_email}`}
                        </p>
                        <p className="text-sm text-gray-800">{interacao.descricao}</p>
                      </li>
                    ))}
                    {interacoes.length === 0 && <p className="text-sm text-gray-400">Nenhuma interação registrada ainda.</p>}
                  </ol>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
