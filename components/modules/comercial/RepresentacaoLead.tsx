"use client";

import { useEffect, useState } from "react";
import { BadgePercent } from "lucide-react";
import { comissaoRepresentante, valorBrutoDoLead } from "@/lib/leads";
import { formatarMoeda } from "@/lib/format";
import type { Lead, Parceiro } from "@/lib/types/domain";
import { toast } from "./toast";

/** Representação do lead (migração 055): qual representante trouxe a venda
 * e o % dele. O valor do lead continua sendo a nossa proposta; aqui aparece a
 * comissão e o líquido, tanto do estimado quanto do fechado. Pode ser
 * ligado/trocado/removido a qualquer momento. */
export default function RepresentacaoLead({ lead, onSalvo }: { lead: Lead; onSalvo: () => void }) {
  const [representantes, setRepresentantes] = useState<Parceiro[]>([]);
  const [representanteId, setRepresentanteId] = useState(lead.representante_id ?? "");
  const [percentual, setPercentual] = useState(lead.percentual_representante != null ? String(lead.percentual_representante) : "");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    fetch("/api/operacional/parceiros?capacidade=representante")
      .then((r) => r.json())
      .then((p) => p.success && setRepresentantes(p.data))
      .catch(() => setRepresentantes([]));
  }, []);

  useEffect(() => {
    setRepresentanteId(lead.representante_id ?? "");
    setPercentual(lead.percentual_representante != null ? String(lead.percentual_representante) : "");
  }, [lead.representante_id, lead.percentual_representante]);

  function escolher(id: string) {
    setRepresentanteId(id);
    const padrao = representantes.find((r) => r.id === id)?.percentual_comissao_padrao;
    if (id && padrao != null && percentual === "") setPercentual(String(padrao));
  }

  async function salvar() {
    if (representanteId && percentual === "") return toast.erro("Informe o % do representante.");
    setSalvando(true);
    try {
      const r = await fetch(`/api/comercial/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ representante_id: representanteId || null, percentual_representante: representanteId ? Number(percentual) : null }),
      }).then((x) => x.json());
      if (!r.success) return toast.erro(r.error ?? "Não foi possível salvar a representação.");
      toast.sucesso(representanteId ? "Representação salva." : "Representante removido do lead.");
      onSalvo();
    } finally {
      setSalvando(false);
    }
  }

  const simulado = { ...lead, representante_id: representanteId || null, percentual_representante: representanteId ? Number(percentual) || 0 : null };
  const bruto = valorBrutoDoLead(simulado);
  const comissao = comissaoRepresentante(simulado);
  const alterado = (lead.representante_id ?? "") !== representanteId || String(lead.percentual_representante ?? "") !== percentual;

  return (
    <div className="space-y-3 rounded-lg border border-purple-100 bg-purple-50/40 p-3">
      <h3 className="font-montserrat text-xs font-bold uppercase text-brand">
        <BadgePercent className="icone" aria-hidden /> Representação
      </h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label className="label-field" htmlFor="repr-lead">
            Representante
          </label>
          <select id="repr-lead" className="input-field" value={representanteId} onChange={(e) => escolher(e.target.value)}>
            <option value="">Sem representante (venda direta)</option>
            {representantes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label-field" htmlFor="repr-perc">
            % do representante
          </label>
          <input
            id="repr-perc"
            type="number"
            min={0}
            max={100}
            step="0.01"
            className="input-field"
            disabled={!representanteId}
            value={percentual}
            onChange={(e) => setPercentual(e.target.value)}
          />
        </div>
      </div>
      {representanteId && (
        <dl className="grid grid-cols-3 gap-2 text-sm">
          <div>
            <dt className="text-xs text-gray-500">{lead.etapa === "fechado" && lead.valor_fechado != null ? "Valor fechado" : "Valor da proposta"}</dt>
            <dd className="font-semibold">{formatarMoeda(bruto)}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Comissão</dt>
            <dd className="font-semibold text-status-error">− {formatarMoeda(comissao)}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Líquido para nós</dt>
            <dd className="font-semibold text-accent">{formatarMoeda(bruto - comissao)}</dd>
          </div>
        </dl>
      )}
      {alterado && (
        <button type="button" className="btn-primary" onClick={salvar} disabled={salvando}>
          {salvando ? "Salvando..." : "Salvar representação"}
        </button>
      )}
    </div>
  );
}
