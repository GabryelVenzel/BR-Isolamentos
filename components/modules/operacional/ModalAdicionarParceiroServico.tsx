"use client";

import { useEffect, useState } from "react";
import { toast } from "./toast";
import MultiSelectTiposTrabalho, { TIPOS_TRABALHO_OPCOES } from "./MultiSelectTiposTrabalho";
import type { Parceiro, ServicoParceiroExecucao, TipoTrabalhoOperacional } from "@/lib/types/domain";

interface Props {
  servicoId: string;
  onFechar: () => void;
  onAdicionado: (execucao: ServicoParceiroExecucao) => void;
}

/** Vincula um parceiro ao serviço com seu próprio headcount ("pessoas
 * mobilizadas") e tipos de trabalho — substitui o antigo seletor único de
 * "Parceiro principal" em NovoServicoModal.tsx (ver ServicoDetailModal.tsx →
 * aba Parceiros, e sql-migration-013). */
export default function ModalAdicionarParceiroServico({ servicoId, onFechar, onAdicionado }: Props) {
  const [parceiros, setParceiros] = useState<Parceiro[]>([]);
  const [parceiroId, setParceiroId] = useState("");
  const [pessoasMobilizadas, setPessoasMobilizadas] = useState("");
  const [tiposTrabalho, setTiposTrabalho] = useState<TipoTrabalhoOperacional[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    // capacidade=mao_de_obra (migração 027) — só parceiros que fornecem mão
    // de obra (prestador/ambos); parceria pura não mobiliza gente.
    fetch("/api/operacional/parceiros?ativo=true&capacidade=mao_de_obra")
      .then((r) => r.json())
      .then((p) => p.success && setParceiros(p.data));
  }, []);

  async function salvar() {
    if (!parceiroId) {
      setErro("Selecione o parceiro.");
      return;
    }
    if (!pessoasMobilizadas || Number(pessoasMobilizadas) < 0) {
      setErro("Informe quantas pessoas foram mobilizadas.");
      return;
    }
    if (tiposTrabalho.length === 0) {
      setErro("Selecione pelo menos um tipo de trabalho.");
      return;
    }
    setErro(null);
    setSalvando(true);

    try {
      const response = await fetch(`/api/operacional/servicos/${servicoId}/parceiros`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parceiro_id: parceiroId,
          pessoas_mobilizadas: Number(pessoasMobilizadas),
          tipos_trabalho: tiposTrabalho,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        setErro(payload.error ?? "Erro ao adicionar parceiro.");
        return;
      }

      toast.sucesso("Parceiro adicionado ao serviço.");
      onAdicionado(payload.data);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-brand/60 p-4" onClick={onFechar}>
      <div className="w-full max-w-md rounded-card bg-white p-6 shadow-card-hover" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 font-montserrat text-lg font-bold text-brand">Adicionar Parceiro ao Serviço</h2>

        <div className="space-y-4">
          <div>
            <label className="label-field">
              Parceiro<span className="text-status-error"> *</span>
            </label>
            <select className="input-field" value={parceiroId} onChange={(e) => setParceiroId(e.target.value)}>
              <option value="">Selecione...</option>
              {parceiros.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label-field">
              Pessoas mobilizadas<span className="text-status-error"> *</span>
            </label>
            <input
              type="number"
              min={0}
              className="input-field max-w-[10rem]"
              value={pessoasMobilizadas}
              onChange={(e) => setPessoasMobilizadas(e.target.value)}
            />
            <p className="mt-1 text-xs text-gray-400">Usado pra compor a legenda de execução e a aba Capacidade.</p>
          </div>

          <div>
            <label className="label-field">
              Tipos de trabalho<span className="text-status-error"> *</span>
            </label>
            <MultiSelectTiposTrabalho value={tiposTrabalho} onChange={setTiposTrabalho} options={TIPOS_TRABALHO_OPCOES} />
          </div>

          {erro && <p className="text-sm text-status-error">{erro}</p>}

          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={onFechar}>
              Cancelar
            </button>
            <button type="button" className="btn-primary" onClick={salvar} disabled={salvando}>
              {salvando ? "Adicionando..." : "Adicionar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
