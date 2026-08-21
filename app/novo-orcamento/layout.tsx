"use client";

import { usePathname } from "next/navigation";

const STEPS = [
  { path: "step-1-cliente", label: "Cliente" },
  { path: "step-2-especificacoes", label: "Especificações" },
  { path: "step-3-calculos", label: "Cálculos" },
  { path: "step-4-precos", label: "Preços" },
  { path: "step-5-revisao", label: "Revisão" },
];

export default function NovoOrcamentoLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const stepAtual = STEPS.findIndex((step) => pathname.includes(step.path));

  return (
    <div className="space-y-8">
      <ol className="flex flex-wrap items-center gap-2 text-sm">
        {STEPS.map((step, index) => {
          const ativo = index === stepAtual;
          const concluido = stepAtual > index;
          return (
            <li key={step.path} className="flex items-center gap-2">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                  ativo
                    ? "bg-accent text-white"
                    : concluido
                      ? "bg-accent-light text-accent-dark"
                      : "bg-gray-100 text-gray-400"
                }`}
              >
                {index + 1}
              </span>
              <span className={ativo ? "font-medium text-gray-900" : "text-gray-400"}>{step.label}</span>
              {index < STEPS.length - 1 && <span className="mx-1 text-gray-300">→</span>}
            </li>
          );
        })}
      </ol>

      {children}
    </div>
  );
}
