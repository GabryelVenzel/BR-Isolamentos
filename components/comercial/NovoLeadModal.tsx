"use client";

import { useEffect, useState } from "react";
import FormCliente from "@/components/FormCliente";
import { formatarMoeda } from "@/lib/format";
import type { Cliente } from "@/lib/types";
import { ORIGENS_LEAD, type OrigemLead, type Parceiro, type TemperaturaLead } from "@/lib/types/domain";

interface Props {
  /** `leadId` só vem preenchido quando o lead criado é de comissão (migração
   * 026) — o chamador usa isso pra abrir o detalhe do lead direto em
   * seguida, já que o comprovante (anexo) não dá pra anexar durante a
   * criação (só existe upload pra um lead que já tem id, ver AnexosLead.tsx)
   * — o próximo passo natural é abrir o lead recém-criado e adicionar o
   * anexo ali. */
  onCriado: (leadId?: string) => void;
  onFechar: () => void;
}

/** Modal de criação de lead — reaproveita o mesmo `FormCliente` do wizard de
 * orçamento (busca cliente existente ou cadastra um novo).
 *
 * Sem campos de "Próxima ação"/"Notas" aqui de propósito — o acompanhamento
 * do lead (o que fazer a seguir, anotações) passou a ser feito via
 * Interações (LeadDetailModal, aba Interações), registradas depois que o
 * lead já existe. Criar o lead é só o primeiro passo.
 *
 * Origem é um dropdown de lista fixa (ORIGENS_LEAD), não texto livre — e
 * fica IMUTÁVEL depois que o lead é criado (ver atualizarLead.ts).
 *
 * Comissão/indicação (migração 026): checkbox "É Comissão/Indicação?" abre
 * os campos de Parceiro/Valor Indicado/% Comissão — o comprovante (anexo)
 * NÃO é pedido aqui (ver `onCriado` acima) — a validação de verdade
 * acontece ao tentar mover o lead pra "Negociação" (ver moverLead.ts), que é
 * o ponto em que o CRM já bloqueia lead normal sem orçamento. */
export default function NovoLeadModal({ onCriado, onFechar }: Props) {
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [temperatura, setTemperatura] = useState<TemperaturaLead>("morno");
  const [valorEstimado, setValorEstimado] = useState("");
  const [origem, setOrigem] = useState<OrigemLead | "">("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [ehComissao, setEhComissao] = useState(false);
  const [parceiros, setParceiros] = useState<Parceiro[]>([]);
  const [parceiroId, setParceiroId] = useState("");
  const [valorIndicado, setValorIndicado] = useState("");
  const [percentualComissao, setPercentualComissao] = useState("");

  useEffect(() => {
    if (!ehComissao || parceiros.length > 0) return;
    fetch("/api/operacional/parceiros?ativo=true")
      .then((r) => r.json())
      .then((payload) => payload.success && setParceiros(payload.data))
      .catch(() => setParceiros([]));
  }, [ehComissao, parceiros.length]);

  const valorComissaoCalculado =
    valorIndicado && percentualComissao ? (Number(valorIndicado) * Number(percentualComissao)) / 100 : 0;

  async function salvar() {
    if (!cliente) {
      setErro("Selecione ou cadastre um cliente.");
      return;
    }
    if (ehComissao && (!parceiroId || !valorIndicado || Number(valorIndicado) <= 0 || !percentualComissao)) {
      setErro("Preencha parceiro, valor indicado e % de comissão.");
      return;
    }
    setErro(null);
    setSalvando(true);

    try {
      const response = await fetch("/api/comercial/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente_id: cliente.id,
          etapa: "prospeccao",
          temperatura,
          valor_estimado: valorEstimado ? Number(valorEstimado) : 0,
          origem: origem || null,
          eh_comissao: ehComissao,
          parceiro_id: ehComissao ? parceiroId : null,
          valor_indicado: ehComissao ? Number(valorIndicado) : null,
          percentual_comissao: ehComissao ? Number(percentualComissao) : null,
        }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        setErro(payload.error ?? "Erro ao criar lead.");
        return;
      }

      onCriado(ehComissao ? payload.data.id : undefined);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand/60 p-4" onClick={onFechar}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-card bg-white p-6 shadow-card-hover"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 font-montserrat text-lg font-bold text-brand">Novo Lead</h2>

        <div className="space-y-4">
          <FormCliente clienteSelecionado={cliente} onSelecionar={setCliente} />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label-field">Temperatura</label>
              <select
                className="input-field"
                value={temperatura}
                onChange={(e) => setTemperatura(e.target.value as TemperaturaLead)}
              >
                <option value="frio">Frio</option>
                <option value="morno">Morno</option>
                <option value="quente">Quente</option>
              </select>
            </div>
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
            <div className="sm:col-span-2">
              <label className="label-field">Origem</label>
              <select
                className="input-field"
                value={origem}
                onChange={(e) => setOrigem(e.target.value as OrigemLead | "")}
              >
                <option value="">Selecione a origem...</option>
                {ORIGENS_LEAD.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-400">Não pode ser alterada depois que o lead for criado.</p>
            </div>
          </div>

          <div className="rounded-lg border border-dashed border-gray-300 p-3">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input type="checkbox" checked={ehComissao} onChange={(e) => setEhComissao(e.target.checked)} />
              🎁 É Comissão/Indicação?
            </label>
            <p className="mt-1 text-xs text-gray-400">
              Indicação pra um parceiro executar — sem orçamento vinculado, só o comprovante da indicação (anexo,
              adicionado depois de criar o lead).
            </p>

            {ehComissao && (
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="label-field">Parceiro*</label>
                  <select className="input-field" value={parceiroId} onChange={(e) => setParceiroId(e.target.value)}>
                    <option value="">Selecione o parceiro...</option>
                    {parceiros.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label-field">Valor indicado (R$)*</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input-field"
                    value={valorIndicado}
                    onChange={(e) => setValorIndicado(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label-field">% Comissão*</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    max={100}
                    className="input-field"
                    value={percentualComissao}
                    onChange={(e) => setPercentualComissao(e.target.value)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="label-field">Valor da comissão (calculado)</label>
                  <p className="input-field cursor-default bg-gray-50 font-semibold text-brand">
                    {formatarMoeda(valorComissaoCalculado)}
                  </p>
                </div>
              </div>
            )}
          </div>

          {erro && <p className="text-sm text-status-error">{erro}</p>}

          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={onFechar}>
              Cancelar
            </button>
            <button type="button" className="btn-primary" onClick={salvar} disabled={salvando}>
              {salvando ? "Salvando..." : "Criar lead"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
