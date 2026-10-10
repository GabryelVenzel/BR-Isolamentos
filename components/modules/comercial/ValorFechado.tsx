"use client";

import { useEffect, useState } from "react";
import { CampoMoeda } from "@/components/ui/CamposDocumento";
import { empilharModal } from "@/components/ui/pilha-modais";
import { formatarMoeda } from "@/lib/format";
import type { Lead } from "@/lib/types/domain";

// Pergunta "por quanto fechou?" ao mover um lead para Fechado (migração 043).
// Mesmo desenho do diálogo de confirmação (components/ui/confirmar.tsx): uma
// função que devolve uma promessa + um host montado uma vez na tela do
// Comercial. Uso:
//
//   const valor = await pedirValorFechado(lead);
//   if (valor === null) return; // cancelou — o lead não é movido

type LeadParaFechar = Pick<Lead, "numero_lead" | "valor_estimado" | "valor_fechado" | "cliente" | "orcamento">;

interface Pedido {
  lead: LeadParaFechar;
  resolver: (valor: number | null) => void;
}

let abrir: ((pedido: Pedido) => void) | null = null;

export function pedirValorFechado(lead: LeadParaFechar): Promise<number | null> {
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

  useEffect(() => {
    abrir = (novo) => {
      // Sugestão: o que já foi fechado antes (reabertura), senão o valor do cartão.
      const sugerido = novo.lead.valor_fechado ?? novo.lead.valor_estimado;
      setValor(sugerido > 0 ? String(sugerido) : "");
      setErro(null);
      setPedido((atual) => {
        atual?.resolver(null);
        return novo;
      });
    };
    return () => {
      abrir = null;
    };
  }, []);

  function responder(resposta: number | null) {
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
  const valorOrcamento = lead.orcamento?.valor_final ?? null;
  const difereDoOrcamento = valorOrcamento !== null && numero > 0 && Math.abs(numero - valorOrcamento) >= 0.01;

  function confirmar() {
    if (!numero || numero <= 0) {
      setErro("Informe por quanto o negócio foi fechado.");
      return;
    }
    responder(numero);
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-brand/60 p-4">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="valor-fechado-titulo"
        className="w-full max-w-md rounded-card bg-white p-6 shadow-card-hover"
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

        {valorOrcamento !== null && (
          <p className={`mt-3 rounded-input px-3 py-2 text-xs ${difereDoOrcamento ? "bg-secondary-light text-brand" : "bg-gray-50 text-gray-600"}`}>
            Orçamento vinculado{lead.orcamento?.numero ? ` (${lead.orcamento.numero})` : ""}: <strong>{formatarMoeda(valorOrcamento)}</strong>
            {difereDoOrcamento && " — diferente do valor fechado. Normal em proposta por metro ou unidade, ou com desconto negociado; confira antes de confirmar."}
          </p>
        )}

        {erro && (
          <p role="alert" className="mt-3 text-sm text-status-error">
            {erro}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
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
