"use client";

import { useEffect, useState } from "react";
import { toast } from "./toast";
import MultiSelectTiposTrabalho, { TIPOS_TRABALHO_OPCOES } from "./MultiSelectTiposTrabalho";
import { formatarMoeda } from "@/lib/format";
import type { Lead, TipoTrabalhoOperacional } from "@/lib/types/domain";

interface Props {
  /** Se já vier de um lead específico (fluxo "Lead fechado → Criar
   * serviço?", ver LeadDetailModal.tsx do módulo Comercial), pula o
   * seletor de lead. Se omitido (botão "+ Novo Serviço" da própria aba
   * Serviços), lista leads fechados pra escolher. */
  leadIdInicial?: string;
  onFechar: () => void;
  onCriado: () => void;
}

/** Cria um serviço (S00001) a partir de um lead fechado — código,
 * lead/orçamento/cliente/valor orçado vêm todos do lead vinculado, não são
 * pedidos de novo (é o ponto da rastreabilidade Lead→Orçamento→Serviço).
 * Parceiros NÃO são pedidos aqui — são adicionados depois em Detalhes → aba
 * Parceiros (pedido explícito, ver ServicoDetailModal.tsx e
 * sql-migration-013). Responsável passou a ser obrigatório na criação. */
export default function NovoServicoModal({ leadIdInicial, onFechar, onCriado }: Props) {
  const [leadsFechados, setLeadsFechados] = useState<Lead[]>([]);
  const [leadId, setLeadId] = useState(leadIdInicial ?? "");
  const [leadSelecionado, setLeadSelecionado] = useState<Lead | null>(null);
  const [usuarios, setUsuarios] = useState<Array<{ email: string; nome: string }>>([]);

  const [tiposTrabalho, setTiposTrabalho] = useState<TipoTrabalhoOperacional[]>([]);
  const [responsavelEmail, setResponsavelEmail] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFimPrevista, setDataFimPrevista] = useState("");
  // Campo "Descrição" removido — duplicava "Notas" (mesma finalidade, dois
  // campos de texto livre confundiam). `servicos.descricao` continua no
  // schema por compatibilidade com serviços já criados antes desta mudança,
  // só não é mais preenchido por aqui.
  const [notas, setNotas] = useState("");

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/usuarios")
      .then((r) => r.json())
      .then(setUsuarios)
      .catch(() => setUsuarios([]));

    if (!leadIdInicial) {
      fetch("/api/comercial/leads?etapa=fechado")
        .then((r) => r.json())
        .then((p) => p.success && setLeadsFechados(p.data));
    }
  }, [leadIdInicial]);

  useEffect(() => {
    if (!leadId) {
      setLeadSelecionado(null);
      return;
    }
    fetch(`/api/comercial/leads/${leadId}`)
      .then((r) => r.json())
      .then((p) => p.success && setLeadSelecionado(p.data));
  }, [leadId]);

  async function salvar() {
    if (!leadId) {
      setErro("Selecione o lead.");
      return;
    }
    if (!leadSelecionado?.orcamento_id) {
      setErro("Este lead não tem orçamento vinculado — vincule um orçamento antes de criar o serviço.");
      return;
    }
    if (tiposTrabalho.length === 0) {
      setErro("Selecione pelo menos 1 tipo de trabalho.");
      return;
    }
    if (!responsavelEmail) {
      setErro("Selecione o responsável.");
      return;
    }
    if (!dataInicio) {
      setErro("Informe a data de início.");
      return;
    }
    setErro(null);
    setSalvando(true);

    try {
      const response = await fetch("/api/operacional/servicos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead_id: leadId,
          orcamento_id: leadSelecionado.orcamento_id,
          tipos_trabalho: tiposTrabalho,
          responsavel_email: responsavelEmail,
          data_inicio: dataInicio,
          data_fim_prevista: dataFimPrevista || null,
          notas: notas || null,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        setErro(payload.error ?? "Erro ao criar serviço.");
        return;
      }

      toast.sucesso(`Serviço ${payload.data.numero_servico} criado.`);
      onCriado();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand/60 p-4" onClick={onFechar}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-card bg-white p-6 shadow-card-hover" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 font-montserrat text-lg font-bold text-brand">Novo Serviço</h2>

        <div className="space-y-4">
          {!leadIdInicial && (
            <div>
              <label className="label-field">
                Lead fechado<span className="text-status-error"> *</span>
              </label>
              <select className="input-field" value={leadId} onChange={(e) => setLeadId(e.target.value)}>
                <option value="">Selecione...</option>
                {leadsFechados.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.numero_lead ?? l.id} — {l.cliente?.nome ?? "—"}
                  </option>
                ))}
              </select>
            </div>
          )}

          {leadSelecionado && (
            <div className="space-y-1 rounded-card bg-gray-50 p-3 text-sm">
              <p>
                <span className="text-gray-500">Lead:</span> {leadSelecionado.numero_lead ?? leadSelecionado.id}
              </p>
              <p>
                <span className="text-gray-500">Cliente:</span> {leadSelecionado.cliente?.nome ?? "—"}
              </p>
              {leadSelecionado.orcamento_id ? (
                <p>
                  <span className="text-gray-500">Valor orçado:</span> {formatarMoeda(leadSelecionado.valor_estimado)}
                </p>
              ) : (
                <p className="text-status-error">Este lead não tem orçamento vinculado.</p>
              )}
            </div>
          )}

          <div>
            <label className="label-field">
              Tipos de trabalho<span className="text-status-error"> *</span>
            </label>
            <MultiSelectTiposTrabalho value={tiposTrabalho} onChange={setTiposTrabalho} options={TIPOS_TRABALHO_OPCOES} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label-field">
                Responsável<span className="text-status-error"> *</span>
              </label>
              <select className="input-field" value={responsavelEmail} onChange={(e) => setResponsavelEmail(e.target.value)}>
                <option value="">Selecione...</option>
                {usuarios.map((u) => (
                  <option key={u.email} value={u.email}>
                    {u.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-field">
                Data início<span className="text-status-error"> *</span>
              </label>
              <input type="date" className="input-field" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
            </div>
            <div>
              <label className="label-field">Data fim prevista</label>
              <input type="date" className="input-field" value={dataFimPrevista} onChange={(e) => setDataFimPrevista(e.target.value)} />
            </div>
          </div>

          <p className="text-xs text-gray-400">👥 Parceiros são adicionados depois de criar o serviço, na aba Parceiros.</p>

          <div>
            <label className="label-field">Notas</label>
            <textarea className="input-field" rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} />
          </div>

          {erro && <p className="text-sm text-status-error">{erro}</p>}

          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={onFechar}>
              Cancelar
            </button>
            <button type="button" className="btn-primary" onClick={salvar} disabled={salvando}>
              {salvando ? "Criando..." : "Criar Serviço"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
