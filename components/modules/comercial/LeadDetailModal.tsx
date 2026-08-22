"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "./toast";
import {
  classesTemperatura,
  formatarDataHora,
  formatarEtapa,
  formatarMoeda,
  formatarTemperatura,
} from "@/lib/format";
import type {
  EtapaFunil,
  HistoricoMudancaLead,
  InteracaoLead,
  Lead,
  TemperaturaLead,
  TipoInteracaoLead,
} from "@/lib/types/domain";

const ETAPAS: EtapaFunil[] = ["prospeccao", "contato", "proposta", "negociacao", "fechado", "perdido"];
const TEMPERATURAS: TemperaturaLead[] = ["quente", "morno", "frio"];
const TIPOS_INTERACAO: TipoInteracaoLead[] = ["nota", "email", "chamada", "reuniao", "proposta_enviada"];
const LABEL_TIPO_INTERACAO: Record<TipoInteracaoLead, string> = {
  nota: "Nota",
  email: "E-mail",
  chamada: "Ligação",
  reuniao: "Reunião",
  proposta_enviada: "Proposta enviada",
};

type AbaInterna = "dados" | "timeline" | "interacoes";

interface Props {
  leadId: string;
  onFechar: () => void;
  onLeadMudou: () => void;
}

function descreverMudanca(h: HistoricoMudancaLead): string {
  switch (h.tipo_mudanca) {
    case "criacao":
      return `Criado em ${h.etapa_nova ? formatarEtapa(h.etapa_nova) : "—"} · ${h.temperatura_nova ? formatarTemperatura(h.temperatura_nova) : "—"}`;
    case "mudanca_etapa":
      return `Movido de ${h.etapa_anterior ? formatarEtapa(h.etapa_anterior) : "—"} para ${h.etapa_nova ? formatarEtapa(h.etapa_nova) : "—"}`;
    case "mudanca_temperatura":
      return `Temperatura alterada de ${h.temperatura_anterior ? formatarTemperatura(h.temperatura_anterior) : "—"} para ${h.temperatura_nova ? formatarTemperatura(h.temperatura_nova) : "—"}`;
    case "reativacao_manual":
      return "Reativado manualmente (Frio → Morno, etapa → Contato)";
    case "reativacao_automatica":
      return "Reativado automaticamente (prazo de recontato vencido)";
    default:
      return h.tipo_mudanca;
  }
}

export default function LeadDetailModal({ leadId, onFechar, onLeadMudou }: Props) {
  const [aba, setAba] = useState<AbaInterna>("dados");
  const [lead, setLead] = useState<Lead | null>(null);
  const [historico, setHistorico] = useState<HistoricoMudancaLead[]>([]);
  const [interacoes, setInteracoes] = useState<InteracaoLead[]>([]);
  const [carregando, setCarregando] = useState(true);

  // Campos de cadastro (Seção 1) — editados localmente, só enviados no
  // "Salvar" pra não disparar um PATCH a cada tecla.
  const [valorEstimado, setValorEstimado] = useState("");
  const [origem, setOrigem] = useState("");
  const [proximaAcao, setProximaAcao] = useState("");
  const [notas, setNotas] = useState("");
  const [atribuidoA, setAtribuidoA] = useState("");
  const [salvandoDados, setSalvandoDados] = useState(false);

  // Etapa/temperatura (Seção "Mudar status") — cada uma salva via seu
  // próprio endpoint (moverLead / mudarTemperatura), não pelo PATCH geral.
  const [etapaSelecionada, setEtapaSelecionada] = useState<EtapaFunil>("prospeccao");
  const [temperaturaSelecionada, setTemperaturaSelecionada] = useState<TemperaturaLead>("morno");
  const [prazoCustomDias, setPrazoCustomDias] = useState("");
  const [salvandoStatus, setSalvandoStatus] = useState(false);

  const [novaInteracaoTipo, setNovaInteracaoTipo] = useState<TipoInteracaoLead>("nota");
  const [novaInteracaoDescricao, setNovaInteracaoDescricao] = useState("");
  const [salvandoInteracao, setSalvandoInteracao] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [respLead, respHistorico, respInteracoes] = await Promise.all([
        fetch(`/api/comercial/leads/${leadId}`),
        fetch(`/api/comercial/leads/${leadId}/historico`),
        fetch(`/api/comercial/leads/${leadId}/interacoes`),
      ]);
      const [payloadLead, payloadHistorico, payloadInteracoes] = await Promise.all([
        respLead.json(),
        respHistorico.json(),
        respInteracoes.json(),
      ]);

      if (payloadLead.success) {
        const l: Lead = payloadLead.data;
        setLead(l);
        setValorEstimado(l.valor_estimado ? String(l.valor_estimado) : "");
        setOrigem(l.origem ?? "");
        setProximaAcao(l.proxima_acao ?? "");
        setNotas(l.notas ?? "");
        setAtribuidoA(l.atribuido_a ?? "");
        setEtapaSelecionada(l.etapa);
        setTemperaturaSelecionada(l.temperatura);
      }
      if (payloadHistorico.success) setHistorico(payloadHistorico.data);
      if (payloadInteracoes.success) setInteracoes(payloadInteracoes.data);
    } finally {
      setCarregando(false);
    }
  }, [leadId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function salvarDados() {
    setSalvandoDados(true);
    try {
      const response = await fetch(`/api/comercial/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          valor_estimado: valorEstimado ? Number(valorEstimado) : 0,
          origem: origem || null,
          proxima_acao: proximaAcao || null,
          notas: notas || null,
          atribuido_a: atribuidoA || null,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        toast.erro(payload.error ?? "Não foi possível salvar os dados do lead.");
        return;
      }
      toast.sucesso("Dados do lead atualizados.");
      setLead(payload.data);
      onLeadMudou();
    } finally {
      setSalvandoDados(false);
    }
  }

  async function salvarStatus() {
    if (!lead) return;
    setSalvandoStatus(true);
    try {
      if (etapaSelecionada !== lead.etapa) {
        const response = await fetch(`/api/comercial/leads/${leadId}/mover`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ novaEtapa: etapaSelecionada }),
        });
        const payload = await response.json();
        if (!response.ok || !payload.success) {
          toast.erro(payload.error ?? "Não foi possível mover o lead.");
          return;
        }
        toast.sucesso(`Lead movido para ${formatarEtapa(etapaSelecionada)}.`);
      }

      if (temperaturaSelecionada !== lead.temperatura) {
        const response = await fetch(`/api/comercial/leads/${leadId}/temperatura`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            novaTemperatura: temperaturaSelecionada,
            intervaloDiasCustom: prazoCustomDias ? Number(prazoCustomDias) : undefined,
          }),
        });
        const payload = await response.json();
        if (!response.ok || !payload.success) {
          toast.erro(payload.error ?? "Não foi possível mudar a temperatura.");
          return;
        }
        if (temperaturaSelecionada === "frio") {
          const dias = payload.data.agendamento?.intervalo_dias;
          toast.aviso(`Lead congelado — reativação agendada${dias ? ` para daqui a ${dias} dias` : ""}.`);
        } else {
          toast.sucesso(`Temperatura alterada para ${formatarTemperatura(temperaturaSelecionada)}.`);
        }
      }

      setPrazoCustomDias("");
      await carregar();
      onLeadMudou();
    } finally {
      setSalvandoStatus(false);
    }
  }

  async function excluir() {
    if (!confirm("Excluir este lead? Esta ação não pode ser desfeita.")) return;
    const response = await fetch(`/api/comercial/leads/${leadId}`, { method: "DELETE" });
    if (response.ok) {
      toast.sucesso("Lead excluído.");
      onLeadMudou();
      onFechar();
    } else {
      toast.erro("Não foi possível excluir o lead.");
    }
  }

  async function adicionarInteracao() {
    if (!novaInteracaoDescricao.trim()) return;
    setSalvandoInteracao(true);
    try {
      const response = await fetch(`/api/comercial/leads/${leadId}/interacoes`, {
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

  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-brand/60" onClick={onFechar}>
      <div
        className="flex h-full w-full max-w-xl flex-col overflow-y-auto bg-white shadow-card-hover"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-gray-100 p-4">
          <button type="button" className="text-sm text-brand hover:underline" onClick={onFechar}>
            ← Voltar ao funil
          </button>

          {lead && (
            <div className="mt-2 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-montserrat text-lg font-bold text-brand">{lead.cliente?.nome ?? "Lead"}</h2>
                <div className="mt-1 flex items-center gap-2">
                  <span className="badge bg-brand-light text-brand">{formatarEtapa(lead.etapa)}</span>
                  <span className={`badge ${classesTemperatura(lead.temperatura)}`}>{formatarTemperatura(lead.temperatura)}</span>
                </div>
              </div>
              <button type="button" className="btn-danger shrink-0 text-xs" onClick={excluir}>
                Excluir lead ✕
              </button>
            </div>
          )}
        </div>

        {carregando || !lead ? (
          <p className="p-4 text-sm text-gray-500">Carregando...</p>
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

            <div className="flex-1 space-y-4 p-4">
              {aba === "dados" && (
                <>
                  <div className="space-y-3">
                    <h3 className="font-montserrat text-xs font-bold uppercase text-brand">Dados do lead</h3>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="label-field">Valor estimado (R$)</label>
                        <input
                          type="number"
                          step="0.01"
                          className="input-field"
                          value={valorEstimado}
                          onChange={(e) => setValorEstimado(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="label-field">Origem</label>
                        <input className="input-field" value={origem} onChange={(e) => setOrigem(e.target.value)} />
                      </div>
                      <div>
                        <label className="label-field">Próxima ação</label>
                        <input className="input-field" value={proximaAcao} onChange={(e) => setProximaAcao(e.target.value)} />
                      </div>
                      <div>
                        <label className="label-field">Responsável (e-mail)</label>
                        <input className="input-field" value={atribuidoA} onChange={(e) => setAtribuidoA(e.target.value)} />
                      </div>
                    </div>
                    <div>
                      <label className="label-field">Notas</label>
                      <textarea className="input-field" rows={3} value={notas} onChange={(e) => setNotas(e.target.value)} />
                    </div>
                    {lead.cliente?.telefone && <p className="text-xs text-gray-500">Telefone: {lead.cliente.telefone}</p>}
                    {lead.cliente?.email && <p className="text-xs text-gray-500">E-mail: {lead.cliente.email}</p>}
                    <button type="button" className="btn-primary" onClick={salvarDados} disabled={salvandoDados}>
                      {salvandoDados ? "Salvando..." : "Salvar"}
                    </button>
                  </div>

                  <div className="space-y-3 border-t border-gray-100 pt-4">
                    <h3 className="font-montserrat text-xs font-bold uppercase text-brand">Mudar status/etapa</h3>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="label-field">Temperatura</label>
                        <select
                          className="input-field"
                          value={temperaturaSelecionada}
                          onChange={(e) => setTemperaturaSelecionada(e.target.value as TemperaturaLead)}
                        >
                          {TEMPERATURAS.map((t) => (
                            <option key={t} value={t}>
                              {formatarTemperatura(t)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="label-field">Etapa</label>
                        <select
                          className="input-field"
                          value={etapaSelecionada}
                          onChange={(e) => setEtapaSelecionada(e.target.value as EtapaFunil)}
                        >
                          {ETAPAS.map((et) => (
                            <option key={et} value={et}>
                              {formatarEtapa(et)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {temperaturaSelecionada === "frio" && lead.temperatura !== "frio" && (
                      <div>
                        <label className="label-field">
                          Prazo customizado (dias) — opcional, deixe em branco pra usar o padrão da etapa atual
                        </label>
                        <input
                          type="number"
                          className="input-field"
                          value={prazoCustomDias}
                          onChange={(e) => setPrazoCustomDias(e.target.value)}
                          placeholder="Ex.: 15"
                        />
                      </div>
                    )}
                    <button type="button" className="btn-accent" onClick={salvarStatus} disabled={salvandoStatus}>
                      {salvandoStatus ? "Salvando..." : "Salvar status"}
                    </button>
                  </div>
                </>
              )}

              {aba === "timeline" && (
                <div>
                  <h3 className="mb-3 font-montserrat text-xs font-bold uppercase text-brand">Caminho do lead</h3>
                  <ol className="relative space-y-4 border-l-2 border-brand pl-4">
                    {historico.map((h) => (
                      <li key={h.id}>
                        <div className="absolute -ml-[21px] mt-1 h-2.5 w-2.5 rounded-full bg-brand" />
                        <p className="text-xs text-gray-400">
                          {formatarDataHora(h.data_mudanca)}
                          {h.usuario_email && ` · ${h.usuario_email}`}
                        </p>
                        <p className="text-sm text-gray-800">{descreverMudanca(h)}</p>
                      </li>
                    ))}
                    {historico.length === 0 && <p className="text-sm text-gray-400">Sem histórico de mudanças ainda.</p>}
                  </ol>
                </div>
              )}

              {aba === "interacoes" && (
                <div className="space-y-4">
                  <div className="flex flex-col gap-2 border-b border-gray-100 pb-4 sm:flex-row">
                    <select
                      className="input-field sm:w-40"
                      value={novaInteracaoTipo}
                      onChange={(e) => setNovaInteracaoTipo(e.target.value as TipoInteracaoLead)}
                    >
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
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={adicionarInteracao}
                      disabled={salvandoInteracao || !novaInteracaoDescricao.trim()}
                    >
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
