"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import ModuleSubNav from "@/components/ModuleSubNav";
import BarraTotais from "@/components/orcamento/BarraTotais";
import { confirmar } from "@/components/ui/confirmar";
import { ORCAMENTO_SUBNAV } from "@/lib/module-nav";
import { useWizardStore } from "@/lib/store";

// Etapas 2 a 4 se repetem para cada trecho; 5 e 6 valem para o orçamento
// inteiro.
const STEPS = [
  { path: "step-1-cliente", label: "Cliente" },
  { path: "step-2-escopo", label: "Escopo" },
  { path: "step-3-especificacoes", label: "Especificações" },
  { path: "step-4-precos", label: "Preços" },
  { path: "step-5-equipe", label: "Equipe e custos" },
  { path: "step-6-revisao", label: "Revisão" },
];

export default function NovoOrcamentoLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { clienteSelecionado, itens, escopoAtual, reset } = useWizardStore();
  const stepAtual = STEPS.findIndex((step) => pathname.includes(step.path));

  // Até onde dá para pular clicando: as etapas do trecho pedem um cliente;
  // Especificações e Preços pedem um trecho em edição; as do orçamento pedem
  // ao menos um trecho já salvo.
  function liberada(index: number): boolean {
    if (index === 0) return true;
    if (!clienteSelecionado) return false;
    if (index === 1) return true;
    if (index === 2 || index === 3) return escopoAtual.length > 0;
    return itens.length > 0;
  }

  const emAndamento = !!clienteSelecionado || itens.length > 0 || escopoAtual.length > 0;

  async function descartar() {
    const seguir = await confirmar("Descartar este orçamento em andamento? Cliente, trechos, equipe e custos preenchidos até aqui são apagados.", {
      titulo: "Descartar orçamento",
      confirmarLabel: "Descartar",
    });
    if (!seguir) return;
    reset();
    router.push("/novo-orcamento/step-1-cliente");
  }

  return (
    <div className="space-y-8">
      <ModuleSubNav items={ORCAMENTO_SUBNAV} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <ol className="flex flex-wrap items-center gap-2 text-sm">
          {STEPS.map((step, index) => {
            const ativo = index === stepAtual;
            const concluido = stepAtual > index;
            const clicavel = !ativo && liberada(index);
            const conteudo = (
              <>
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                    ativo ? "bg-accent text-white" : concluido ? "bg-accent-light text-accent-dark" : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {index + 1}
                </span>
                <span className={ativo ? "font-medium text-gray-900" : clicavel ? "text-gray-600" : "text-gray-400"}>{step.label}</span>
              </>
            );
            return (
              <li key={step.path} className="flex items-center gap-2">
                {clicavel ? (
                  <Link href={`/novo-orcamento/${step.path}`} className="flex items-center gap-2 rounded-full pr-1 hover:underline">
                    {conteudo}
                  </Link>
                ) : (
                  <span className="flex items-center gap-2" aria-current={ativo ? "step" : undefined}>
                    {conteudo}
                  </span>
                )}
                {index < STEPS.length - 1 && <span className="mx-1 text-gray-300">→</span>}
              </li>
            );
          })}
        </ol>

        {emAndamento && (
          <button type="button" className="text-sm text-status-error hover:underline" onClick={descartar}>
            Descartar orçamento
          </button>
        )}
      </div>

      {children}

      {/* A Tela 4 desenha a própria barra, com o trecho em edição incluído. */}
      {!pathname.includes("step-4-precos") && <BarraTotais />}
    </div>
  );
}
