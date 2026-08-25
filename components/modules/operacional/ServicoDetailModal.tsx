"use client";

import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import { toast } from "./toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatarDataHora, formatarMoeda } from "@/lib/format";
import type { HistoricoServico, InteracaoServico, Servico, TipoInteracaoServico } from "@/lib/types/domain";

const BUCKET = "servicos-anexos";

const LABEL_TIPO_TRABALHO: Record<string, string> = {
  bancada: "Bancada",
  caldeiraria: "Caldeiraria",
  isolamentos_removiveis: "Isolamentos Removíveis",
  isolamentos_fixos: "Isolamentos Fixos",
};
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
  const [salvandoDados, setSalvandoDados] = useState(false);

  const [etapaSelecionada, setEtapaSelecionada] = useState<"planejamento" | "execucao">("planejamento");
  const [salvandoEtapa, setSalvandoEtapa] = useState(false);

  const [valorReal, setValorReal] = useState("");
  const [finalizando, setFinalizando] = useState(false);
  const [enviandoArquivo, setEnviandoArquivo] = useState<string | null>(null);

  const [novaInteracaoTipo, setNovaInteracaoTipo] = useState<TipoInteracaoServico>("nota");
  const [novaInteracaoDescricao, setNovaInteracaoDescricao] = useState("");
  const [salvandoInteracao, setSalvandoInteracao] = useState(false);

  const [erro, setErro] = useState<string | null>(null);

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
        if (s.etapa !== "finalizado") setEtapaSelecionada(s.etapa);
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

  async function salvarEtapa() {
    if (!servico || servico.etapa === etapaSelecionada) return;
    setSalvandoEtapa(true);
    try {
      const response = await fetch(`/api/operacional/servicos/${servicoId}/mover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ novaEtapa: etapaSelecionada }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        toast.erro(payload.error ?? "Não foi possível mover o serviço.");
        return;
      }
      toast.sucesso(`Serviço movido para ${LABEL_ETAPA[etapaSelecionada]}.`);
      await carregar();
      onServicoMudou();
    } finally {
      setSalvandoEtapa(false);
    }
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

  async function confirmarFinalizacao() {
    if (!valorReal) {
      toast.erro("Informe o valor real do serviço.");
      return;
    }
    setFinalizando(true);
    try {
      const response = await fetch(`/api/operacional/servicos/${servicoId}/finalizar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ valor_real: Number(valorReal) }),
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

  const temFotoPrincipal = !!servico?.foto_principal_url;
  const temPdf = !!servico?.pdf_relatorio_url;
  const podeFinalizar = temFotoPrincipal && temPdf && !!valorReal;

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
                      {servico.tipos_trabalho.length > 0
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
                    <p>
                      <span className="text-gray-500">Parceiro principal:</span> {servico.parceiro_principal?.nome ?? "—"}
                      {servico.pessoas_alocadas != null && ` (${servico.pessoas_alocadas} pessoas)`}
                    </p>
                    {servico.responsavel_email && (
                      <p>
                        <span className="text-gray-500">Responsável:</span> {servico.responsavel_email}
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
                  </div>
                  <div>
                    <label className="label-field">Notas</label>
                    <textarea className="input-field" rows={3} value={notas} onChange={(e) => setNotas(e.target.value)} />
                  </div>
                  <button type="button" className="btn-primary" onClick={salvarDados} disabled={salvandoDados}>
                    {salvandoDados ? "Salvando..." : "Salvar"}
                  </button>

                  {servico.etapa !== "finalizado" && (
                    <div className="space-y-3 border-t border-gray-100 pt-4">
                      <h3 className="font-montserrat text-xs font-bold uppercase text-brand">Mudar etapa</h3>
                      <div className="flex items-center gap-3">
                        <select
                          className="input-field max-w-xs"
                          value={etapaSelecionada}
                          onChange={(e) => setEtapaSelecionada(e.target.value as "planejamento" | "execucao")}
                        >
                          <option value="planejamento">Planejamento</option>
                          <option value="execucao">Execução</option>
                        </select>
                        <button type="button" className="btn-accent" onClick={salvarEtapa} disabled={salvandoEtapa}>
                          {salvandoEtapa ? "Salvando..." : "Salvar etapa"}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-3 border-t border-gray-100 pt-4">
                    <h3 className="font-montserrat text-xs font-bold uppercase text-brand">
                      Anexos {servico.etapa !== "finalizado" && "(obrigatórios para finalizar)"}
                    </h3>

                    <div>
                      <label className="label-field">Foto principal {temFotoPrincipal && "✅"}</label>
                      <input type="file" accept="image/*" disabled={enviandoArquivo !== null} onChange={(e) => enviarArquivo(e, "foto_principal_url")} />
                      {servico.foto_principal_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={servico.foto_principal_url} alt="Foto principal" className="mt-2 h-24 rounded-lg object-cover" />
                      )}
                    </div>

                    <div>
                      <label className="label-field">Fotos adicionais ({servico.fotos_url.length})</label>
                      <input type="file" accept="image/*" disabled={enviandoArquivo !== null} onChange={(e) => enviarArquivo(e, "fotos_url")} />
                      {servico.fotos_url.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {servico.fotos_url.map((url) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img key={url} src={url} alt="Foto adicional" className="h-16 w-16 rounded-lg object-cover" />
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="label-field">PDF relatório {temPdf && "✅"}</label>
                      <input type="file" accept="application/pdf" disabled={enviandoArquivo !== null} onChange={(e) => enviarArquivo(e, "pdf_relatorio_url")} />
                      {servico.pdf_relatorio_url && (
                        <a href={servico.pdf_relatorio_url} target="_blank" rel="noreferrer" className="mt-1 block text-xs text-brand hover:underline">
                          Ver PDF anexado
                        </a>
                      )}
                    </div>
                    {enviandoArquivo && <p className="text-xs text-gray-500">Enviando...</p>}
                  </div>

                  {servico.etapa !== "finalizado" && (
                    <div className="space-y-2 rounded-card border-l-4 border-l-secondary bg-secondary-light/40 p-4">
                      <h3 className="font-montserrat text-xs font-bold uppercase text-brand">Finalizar Serviço</h3>
                      <p className="text-xs text-gray-600">{temFotoPrincipal ? "✅" : "❌"} Foto principal</p>
                      <p className="text-xs text-gray-600">{temPdf ? "✅" : "❌"} PDF relatório</p>
                      <div>
                        <label className="label-field">
                          Valor real<span className="text-status-error"> *</span>
                        </label>
                        <input type="number" step="0.01" className="input-field max-w-xs" value={valorReal} onChange={(e) => setValorReal(e.target.value)} />
                      </div>
                      <button
                        type="button"
                        className="btn-accent"
                        onClick={confirmarFinalizacao}
                        disabled={!podeFinalizar || finalizando}
                        title={!podeFinalizar ? "Anexe foto principal, PDF relatório e informe o valor real" : undefined}
                      >
                        {finalizando ? "Finalizando..." : "Confirmar finalização"}
                      </button>
                    </div>
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
