"use client";

import { useEffect, useState } from "react";
import { CampoMoeda } from "@/components/ui/CamposDocumento";
import FormCliente from "@/components/FormCliente";
import { formatarMoeda } from "@/lib/format";
import type { Cliente } from "@/lib/types";
import { ORIGENS_LEAD, type OrigemLead, type Parceiro, type TemperaturaLead } from "@/lib/types/domain";
import FecharComEsc from "@/components/ui/FecharComEsc";
import { BadgePercent, Gift } from "lucide-react";

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
 * Tipo do lead (migração 055): venda direta, PARCERIA (indicação que nós
 * fazemos e pela qual recebemos comissão — campos de Parceiro/Valor
 * Indicado/% Comissão) ou REPRESENTANTE (venda nossa trazida por um
 * representante — valor da nossa proposta + % dele; o cartão mostra o
 * líquido). Na parceria o comprovante (anexo)
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

  const [tipoLead, setTipoLead] = useState<"direta" | "parceria" | "representante">("direta");
  const ehComissao = tipoLead === "parceria";
  const ehRepresentante = tipoLead === "representante";
  const [representantes, setRepresentantes] = useState<Parceiro[]>([]);
  const [representanteId, setRepresentanteId] = useState("");
  const [percentualRepresentante, setPercentualRepresentante] = useState("");
  const [parceiros, setParceiros] = useState<Parceiro[]>([]);
  const [parceiroId, setParceiroId] = useState("");
  const [valorIndicado, setValorIndicado] = useState("");
  const [percentualComissao, setPercentualComissao] = useState("");

  useEffect(() => {
    if (!ehComissao || parceiros.length > 0) return;
    // capacidade=comissao (migração 027) — só parceiros que recebem
    // indicação (parceria/ambos); prestador puro não entra aqui.
    fetch("/api/operacional/parceiros?ativo=true&capacidade=comissao")
      .then((r) => r.json())
      .then((payload) => payload.success && setParceiros(payload.data))
      .catch(() => setParceiros([]));
  }, [ehComissao, parceiros.length]);

  useEffect(() => {
    if (!ehRepresentante || representantes.length > 0) return;
    fetch("/api/operacional/parceiros?ativo=true&capacidade=representante")
      .then((r) => r.json())
      .then((payload) => payload.success && setRepresentantes(payload.data))
      .catch(() => setRepresentantes([]));
  }, [ehRepresentante, representantes.length]);

  function escolherRepresentante(id: string) {
    setRepresentanteId(id);
    const padrao = representantes.find((r) => r.id === id)?.percentual_comissao_padrao;
    if (padrao != null) setPercentualRepresentante(String(padrao));
  }

  const comissaoRepresentanteCalculada = valorEstimado && percentualRepresentante ? (Number(valorEstimado) * Number(percentualRepresentante)) / 100 : 0;

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
    if (ehRepresentante && (!representanteId || percentualRepresentante === "")) {
      setErro("Escolha o representante e o % de comissão dele.");
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
          representante_id: ehRepresentante ? representanteId : null,
          percentual_representante: ehRepresentante ? Number(percentualRepresentante) : null,
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
    <div className="modal-fundo z-50">
      <FecharComEsc onFechar={onFechar} />
      <div
        className="modal-caixa sm:max-w-2xl"
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
              <label className="label-field">{ehRepresentante ? "Valor da nossa proposta (R$)" : "Valor estimado (R$)"}</label>
              <CampoMoeda value={valorEstimado} onChange={setValorEstimado} />
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
            <p className="label-field">Tipo do lead</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Tipo do lead">
              {(
                [
                  ["direta", "Venda direta", "Venda nossa, sem intermediário."],
                  ["parceria", "Parceria", "Indicamos para um parceiro executar e recebemos comissão."],
                  ["representante", "Representante", "Venda nossa trazida por um representante, que recebe comissão."],
                ] as const
              ).map(([valor, label, ajuda]) => (
                <label
                  key={valor}
                  className={`flex cursor-pointer flex-col gap-0.5 rounded-lg border p-2.5 text-sm ${tipoLead === valor ? "border-brand bg-brand-light/40" : "border-gray-200"}`}
                >
                  <span className="flex items-center gap-2 font-medium text-gray-800">
                    <input type="radio" name="tipo-lead" checked={tipoLead === valor} onChange={() => setTipoLead(valor)} />
                    {valor === "parceria" && <Gift className="icone" aria-hidden />}
                    {valor === "representante" && <BadgePercent className="icone" aria-hidden />}
                    {label}
                  </span>
                  <span className="text-xs text-gray-500">{ajuda}</span>
                </label>
              ))}
            </div>
            {ehComissao && (
              <p className="mt-2 text-xs text-gray-400">
                Sem orçamento vinculado — só o comprovante da indicação (anexo, adicionado depois de criar o lead).
              </p>
            )}

            {ehRepresentante && (
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="label-field" htmlFor="lead-representante">
                    Representante*
                  </label>
                  <select id="lead-representante" className="input-field" value={representanteId} onChange={(e) => escolherRepresentante(e.target.value)}>
                    <option value="">Selecione o representante...</option>
                    {representantes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.nome}
                      </option>
                    ))}
                  </select>
                  {representantes.length === 0 && <p className="mt-1 text-xs text-gray-400">Cadastre em Comercial → Representantes.</p>}
                </div>
                <div>
                  <label className="label-field" htmlFor="lead-perc-repr">
                    % do representante*
                  </label>
                  <input
                    id="lead-perc-repr"
                    type="number"
                    step="0.01"
                    min={0}
                    max={100}
                    className="input-field"
                    value={percentualRepresentante}
                    onChange={(e) => setPercentualRepresentante(e.target.value)}
                  />
                </div>
                <div>
                  <p className="label-field">Líquido para nós</p>
                  <p className="input-field cursor-default bg-gray-50 font-semibold text-brand">
                    {formatarMoeda((Number(valorEstimado) || 0) - comissaoRepresentanteCalculada)}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">Comissão: {formatarMoeda(comissaoRepresentanteCalculada)}</p>
                </div>
              </div>
            )}

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
                  <CampoMoeda value={valorIndicado} onChange={setValorIndicado} />
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

          <div className="rodape-modal flex justify-end gap-3">
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
