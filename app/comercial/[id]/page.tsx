"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  classesTemperatura,
  formatarDataHora,
  formatarEtapa,
  formatarMoeda,
  formatarTemperatura,
} from "@/lib/format";
import { TRANSICOES_FUNIL } from "@/lib/usecases/comercial";
import type { EtapaFunil, InteracaoLead, Lead, TipoInteracaoLead } from "@/lib/types/domain";

const TIPOS_INTERACAO: TipoInteracaoLead[] = ["nota", "email", "chamada", "reuniao", "proposta_enviada"];
const LABEL_TIPO_INTERACAO: Record<TipoInteracaoLead, string> = {
  nota: "Nota",
  email: "E-mail",
  chamada: "Ligação",
  reuniao: "Reunião",
  proposta_enviada: "Proposta enviada",
};

export default function LeadDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [lead, setLead] = useState<Lead | null>(null);
  const [interacoes, setInteracoes] = useState<InteracaoLead[]>([]);
  const [movendo, setMovendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [novaInteracaoTipo, setNovaInteracaoTipo] = useState<TipoInteracaoLead>("nota");
  const [novaInteracaoDescricao, setNovaInteracaoDescricao] = useState("");
  const [salvandoInteracao, setSalvandoInteracao] = useState(false);

  const carregar = useCallback(async () => {
    const [respLead, respInteracoes] = await Promise.all([
      fetch(`/api/comercial/leads/${id}`),
      fetch(`/api/comercial/leads/${id}/interacoes`),
    ]);
    const [payloadLead, payloadInteracoes] = await Promise.all([respLead.json(), respInteracoes.json()]);

    if (payloadLead.success) setLead(payloadLead.data);
    if (payloadInteracoes.success) setInteracoes(payloadInteracoes.data);
  }, [id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function mover(novaEtapa: EtapaFunil) {
    setErro(null);
    setMovendo(true);
    try {
      const response = await fetch(`/api/comercial/leads/${id}/mover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ novaEtapa }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        setErro(payload.error ?? "Erro ao mover o lead.");
        return;
      }
      setLead(payload.data);
    } finally {
      setMovendo(false);
    }
  }

  async function excluir() {
    if (!confirm("Excluir este lead? Esta ação não pode ser desfeita.")) return;
    const response = await fetch(`/api/comercial/leads/${id}`, { method: "DELETE" });
    if (response.ok) router.push("/comercial");
  }

  async function adicionarInteracao() {
    if (!novaInteracaoDescricao.trim()) return;
    setSalvandoInteracao(true);
    try {
      const response = await fetch(`/api/comercial/leads/${id}/interacoes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: novaInteracaoTipo, descricao: novaInteracaoDescricao }),
      });
      const payload = await response.json();
      if (response.ok && payload.success) {
        setNovaInteracaoDescricao("");
        setInteracoes((prev) => [payload.data, ...prev]);
      }
    } finally {
      setSalvandoInteracao(false);
    }
  }

  if (!lead) return <p className="text-sm text-gray-500">Carregando...</p>;

  const transicoesPermitidas = TRANSICOES_FUNIL[lead.etapa];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/comercial" className="text-sm text-brand hover:underline">
            ← Voltar ao funil
          </Link>
          <h1 className="mt-1 text-xl font-bold">{lead.cliente?.nome ?? "Lead"}</h1>
          <div className="mt-2 flex items-center gap-2">
            <span className="badge bg-brand-light text-brand">{formatarEtapa(lead.etapa)}</span>
            <span className={`badge ${classesTemperatura(lead.temperatura)}`}>
              {formatarTemperatura(lead.temperatura)}
            </span>
          </div>
        </div>
        <button type="button" className="btn-danger" onClick={excluir}>
          Excluir lead
        </button>
      </div>

      {erro && <p className="text-sm text-status-error">{erro}</p>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card space-y-3 lg:col-span-1">
          <h2 className="font-montserrat text-sm font-bold uppercase text-brand">Dados do lead</h2>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-xs text-gray-500">Valor estimado</dt>
              <dd className="font-montserrat font-bold text-accent">{formatarMoeda(lead.valor_estimado)}</dd>
            </div>
            {lead.origem && (
              <div>
                <dt className="text-xs text-gray-500">Origem</dt>
                <dd>{lead.origem}</dd>
              </div>
            )}
            {lead.proxima_acao && (
              <div>
                <dt className="text-xs text-gray-500">Próxima ação</dt>
                <dd>{lead.proxima_acao}</dd>
              </div>
            )}
            {lead.atribuido_a && (
              <div>
                <dt className="text-xs text-gray-500">Responsável</dt>
                <dd>{lead.atribuido_a}</dd>
              </div>
            )}
            {lead.notas && (
              <div>
                <dt className="text-xs text-gray-500">Notas</dt>
                <dd className="whitespace-pre-wrap">{lead.notas}</dd>
              </div>
            )}
            {lead.cliente?.telefone && (
              <div>
                <dt className="text-xs text-gray-500">Telefone</dt>
                <dd>{lead.cliente.telefone}</dd>
              </div>
            )}
            {lead.cliente?.email && (
              <div>
                <dt className="text-xs text-gray-500">E-mail</dt>
                <dd>{lead.cliente.email}</dd>
              </div>
            )}
          </dl>

          {transicoesPermitidas.length > 0 && (
            <div className="border-t border-gray-100 pt-3">
              <p className="label-field">Mover para</p>
              <div className="flex flex-wrap gap-2">
                {transicoesPermitidas.map((etapa) => (
                  <button
                    key={etapa}
                    type="button"
                    className={etapa === "perdido" ? "btn-danger" : "btn-accent"}
                    disabled={movendo}
                    onClick={() => mover(etapa)}
                  >
                    {formatarEtapa(etapa)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="card space-y-4 lg:col-span-2">
          <h2 className="font-montserrat text-sm font-bold uppercase text-brand">Histórico de interações</h2>

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
      </div>
    </div>
  );
}
