"use client";

import { useEffect, useState } from "react";
import { CampoMoeda } from "@/components/ui/CamposDocumento";
import { empilharModal } from "@/components/ui/pilha-modais";
import { formatarMoeda, formatarNumero } from "@/lib/format";
import { orcamentosDoLead } from "@/lib/leads";
import type { Lead } from "@/lib/types/domain";

// Pergunta "por quanto fechou?" ao mover um lead para Fechado (migração 043).
// Mesmo desenho do diálogo de confirmação (components/ui/confirmar.tsx): uma
// função que devolve uma promessa + um host montado uma vez na tela do
// Comercial. Uso:
//
//   const resposta = await pedirValorFechado(lead);
//   if (resposta === null) return; // cancelou — o lead não é movido
//
// Com vários orçamentos vinculados (migração 053) pergunta também qual(is)
// foi(ram) fechado(s): esses viram "aceito", os outros "rejeitado".

type LeadParaFechar = Pick<Lead, "numero_lead" | "valor_estimado" | "valor_fechado" | "cliente" | "vinculos" | "representante_id" | "percentual_representante">;

export interface RespostaFechamento {
  valor: number;
  /** Orçamentos fechados (ids). Vazio quando o lead não tem orçamento. */
  vencedores: number[];
}

interface Pedido {
  lead: LeadParaFechar;
  resolver: (resposta: RespostaFechamento | null) => void;
}

let abrir: ((pedido: Pedido) => void) | null = null;

export function pedirValorFechado(lead: LeadParaFechar): Promise<RespostaFechamento | null> {
  return new Promise((resolver) => {
    if (!abrir) {
      resolver(null);
      return;
    }
    abrir({ lead, resolver });
  });
}

export default function ValorFechadoHost() {
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [valor, setValor] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [vencedores, setVencedores] = useState<number[]>([]);

  useEffect(() => {
    abrir = (novo) => {
      // Sugestão: o que já foi fechado antes (reabertura), senão o valor do cartão.
      const sugerido = novo.lead.valor_fechado ?? novo.lead.valor_estimado;
      setValor(sugerido > 0 ? String(sugerido) : "");
      setErro(null);
      // Um só orçamento: já vem marcado. Vários: você escolhe.
      const orcs = orcamentosDoLead(novo.lead);
      setVencedores(orcs.length === 1 ? [orcs[0].orcamento_id] : orcs.filter((v) => v.vencedor).map((v) => v.orcamento_id));
      setPedido((atual) => {
        atual?.resolver(null);
        return novo;
      });
    };
    return () => {
      abrir = null;
    };
  }, []);

  function responder(resposta: RespostaFechamento | null) {
    setPedido((atual) => {
      atual?.resolver(resposta);
      return null;
    });
  }

  useEffect(() => {
    if (!pedido) return;
    return empilharModal(() => responder(null));
  }, [pedido]);

  if (!pedido) return null;

  const { lead } = pedido;
  const numero = Number(valor);
  const orcamentos = orcamentosDoLead(lead);
  const escolhidos = orcamentos.filter((v) => vencedores.includes(v.orcamento_id));
  const valorOrcamento = escolhidos.length > 0 ? escolhidos.reduce((s, v) => s + v.orcamento.valor_final, 0) : null;
  const difereDoOrcamento = valorOrcamento !== null && numero > 0 && Math.abs(numero - valorOrcamento) >= 0.01;

  function confirmar() {
    if (!numero || numero <= 0) {
      setErro("Informe por quanto o negócio foi fechado.");
      return;
    }
    if (orcamentos.length > 0 && vencedores.length === 0) {
      setErro("Marque qual orçamento foi fechado.");
      return;
    }
    responder({ valor: numero, vencedores });
  }

  return (
    <div className="modal-fundo z-[90]">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="valor-fechado-titulo"
        className="modal-caixa sm:max-w-md"
        onSubmit={(e) => {
          e.preventDefault();
          confirmar();
        }}
      >
        <h2 id="valor-fechado-titulo" className="mb-1 font-montserrat text-lg font-bold text-brand">
          Fechar venda
        </h2>
        <p className="mb-4 text-sm text-gray-600">
          {lead.numero_lead ?? "Lead"}
          {lead.cliente?.nome ? ` — ${lead.cliente.nome}` : ""}. Por quanto o negócio foi fechado?
        </p>

        <label className="label-field" htmlFor="valor-fechado">
          Valor fechado<span className="text-status-error"> *</span>
        </label>
        <CampoMoeda id="valor-fechado" value={valor} onChange={setValor} />
        <p className="mt-1 text-xs text-gray-500">
          Vira o valor orçado da obra e entra nos indicadores de vendas. O orçamento vinculado não é alterado.
        </p>

        {lead.representante_id && numero > 0 && (
          <p className="mt-3 rounded-input bg-purple-50 px-3 py-2 text-xs text-purple-900">
            Representante ({formatarNumero(Number(lead.percentual_representante ?? 0), 2)}%): comissão de{" "}
            <strong>{formatarMoeda((numero * Number(lead.percentual_representante ?? 0)) / 100)}</strong> — líquido para nós{" "}
            <strong>{formatarMoeda(numero - (numero * Number(lead.percentual_representante ?? 0)) / 100)}</strong>.
          </p>
        )}

        {orcamentos.length > 1 && (
          <fieldset className="mt-4">
            <legend className="label-field">Qual orçamento foi fechado?</legend>
            <p className="mb-2 text-xs text-gray-500">Os marcados viram Aceito; os demais, Rejeitado. O serviço nasce do orçamento fechado.</p>
            <div className="space-y-1">
              {orcamentos.map((v) => (
                <label key={v.orcamento_id} className="flex items-center gap-2 rounded-input border border-gray-200 px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={vencedores.includes(v.orcamento_id)}
                    onChange={(e) =>
                      setVencedores((atual) => (e.target.checked ? [...atual, v.orcamento_id] : atual.filter((id) => id !== v.orcamento_id)))
                    }
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {v.orcamento.numero}
                    {v.orcamento.numero_orcamento ? ` (${v.orcamento.numero_orcamento})` : ""}
                  </span>
                  <strong className="shrink-0">{formatarMoeda(v.orcamento.valor_final)}</strong>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {valorOrcamento !== null && (
          <p className={`mt-3 rounded-input px-3 py-2 text-xs ${difereDoOrcamento ? "bg-secondary-light text-brand" : "bg-gray-50 text-gray-600"}`}>
            {escolhidos.length === 1 ? `Orçamento fechado (${escolhidos[0].orcamento.numero})` : "Soma dos orçamentos fechados"}: <strong>{formatarMoeda(valorOrcamento)}</strong>
            {difereDoOrcamento && " — diferente do valor fechado. Normal em proposta por metro ou unidade, ou com desconto negociado; confira antes de confirmar."}
          </p>
        )}

        {erro && (
          <p role="alert" className="mt-3 text-sm text-status-error">
            {erro}
          </p>
        )}

        <div className="rodape-modal flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={() => responder(null)}>
            Cancelar
          </button>
          <button type="submit" className="btn-accent">
            Fechar venda
          </button>
        </div>
      </form>
    </div>
  );
}
