"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { confirmar } from "@/components/ui/confirmar";
import { useWizardStore } from "@/lib/store";
import { estadoWizardValido, reconstruirEstadoWizard } from "@/lib/usecases/orcamento";
import type { ConfigEmpresa, Orcamento, PrecoConfig } from "@/lib/types";

/** Editar Orçamento — reabre o orçamento no wizard completo (cliente, escopo,
 * especificações, preços, equipe e custos, revisão), como se estivesse sendo
 * orçado do zero; salvar na Revisão ATUALIZA este orçamento (mesmo número).
 *
 * Esta página só carrega e redireciona. Se o orçamento tem a cópia do wizard
 * guardada ao salvar (migração 049), volta exatamente como foi montado;
 * senão é reconstruído a partir do que foi persistido, com avisos do que
 * precisa ser conferido (ver lib/usecases/orcamento/reabrirOrcamento.ts).
 *
 * Substitui a tela antiga, que só mudava status, margem e desconto — e
 * calculava a margem errado (aplicava o percentual sobre o valor final antigo
 * e não refazia os impostos). Margem e desconto agora ficam na etapa "Equipe
 * e custos" e passam pelo mesmo motor de cálculo do orçamento novo. */
export default function EditarOrcamentoPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const iniciado = useRef(false);

  useEffect(() => {
    if (iniciado.current) return;
    iniciado.current = true;

    (async () => {
      try {
        const [resposta, config, precos] = await Promise.all([
          fetch(`/api/orcamentos/${id}/wizard`).then(async (r) => ({ ok: r.ok, corpo: await r.json() })),
          fetch("/api/config-empresa").then((r) => r.json() as Promise<ConfigEmpresa>),
          fetch("/api/precos-config").then((r) => r.json() as Promise<PrecoConfig[]>),
        ]);
        if (!resposta.ok) {
          setErro(resposta.corpo?.error ?? "Não foi possível abrir o orçamento.");
          return;
        }
        const orcamento = resposta.corpo.orcamento as Orcamento;
        if (!orcamento.cliente) {
          setErro("Este orçamento está sem cliente — não dá para reabri-lo.");
          return;
        }

        // Já existe outro orçamento em andamento no wizard? Reabrir este
        // apaga o que está lá.
        const atual = useWizardStore.getState();
        const outroEmAndamento = atual.edicao?.id !== orcamento.id && (atual.itens.length > 0 || atual.escopoAtual.length > 0);
        if (outroEmAndamento) {
          const seguir = await confirmar(
            `Há ${atual.edicao ? `uma edição do ${atual.edicao.numero}` : "um orçamento novo"} em andamento no wizard. Abrir o ${orcamento.numero} para editar descarta o que está lá.`,
            { titulo: "Substituir o orçamento em andamento?", confirmarLabel: `Editar ${orcamento.numero}` }
          );
          if (!seguir) {
            router.push("/historico");
            return;
          }
        }

        const reaberto = estadoWizardValido(resposta.corpo.estado)
          ? { estado: resposta.corpo.estado, avisos: [] as string[] }
          : reconstruirEstadoWizard(orcamento, config, Array.isArray(precos) ? precos : []);

        useWizardStore.getState().carregarParaEdicao({
          cliente: orcamento.cliente,
          estado: reaberto.estado,
          edicao: { id: orcamento.id, numero: orcamento.numero, status: orcamento.status, avisos: reaberto.avisos },
        });
        router.replace("/novo-orcamento/step-6-revisao");
      } catch {
        setErro("Erro de conexão ao abrir o orçamento.");
      }
    })();
  }, [id, router]);

  if (erro) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-status-error">{erro}</p>
        <button type="button" className="btn-secondary" onClick={() => router.push("/historico")}>
          ← Voltar ao Histórico
        </button>
      </div>
    );
  }
  return <p className="text-sm text-gray-500">Abrindo o orçamento para edição...</p>;
}
