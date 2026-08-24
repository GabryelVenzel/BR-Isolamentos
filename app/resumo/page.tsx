"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import DashboardGeral from "@/components/modules/resumo/DashboardGeral";
import DashboardOperacao from "@/components/modules/resumo/DashboardOperacao";
import DashboardComercial from "@/components/modules/resumo/DashboardComercial";
import DashboardFinanceira from "@/components/modules/resumo/DashboardFinanceira";

type AbaResumo = "geral" | "operacao" | "comercial" | "financeira";

const ABAS: Array<{ valor: AbaResumo; label: string; subtitulo: string }> = [
  { valor: "geral", label: "Geral", subtitulo: "Dashboard executivo — saúde financeira, vendas e operação em uma tela." },
  { valor: "operacao", label: "Operação", subtitulo: "Relatórios operacionais — funil de obras, prazos e custos." },
  { valor: "comercial", label: "Comercial", subtitulo: "Relatórios comerciais — funil de conversão, origem e performance." },
  { valor: "financeira", label: "Financeira", subtitulo: "Relatórios financeiros — receitas, despesas, categorias e margem." },
];

const CHAVE_ABA = "br-isolamentos:resumo-aba";

/** Dashboard centralizado do Resumo — 4 abas que consolidam TODOS os
 * relatórios da empresa num único módulo: "Geral" é a visão executiva
 * (inalterada, era o conteúdo inteiro desta página antes desta mudança —
 * ver DashboardGeral.tsx); "Operação", "Comercial" e "Financeira" são os
 * relatórios detalhados que antes viviam como aba "Relatórios" dentro de
 * cada módulo (Operacional, Comercial, Financeiro respectivamente) e foram
 * removidos de lá — ver os comentários em cada Dashboard*.tsx e no commit
 * pra decisão completa. Cada aba continua chamando a MESMA rota de API que
 * já chamava antes (/api/operacional/relatorios, /api/comercial/relatorios,
 * /api/financeiro/relatorios) — nenhuma rota nova de "/api/resumo/operacao"
 * etc. foi criada, porque essas três rotas já faziam exatamente o que o
 * pedido original propunha para elas; duplicar seria manter dois lugares
 * calculando o mesmo relatório.
 *
 * Aba selecionada persiste entre visitas (localStorage) com `?tab=` na URL
 * tendo prioridade — mesmo padrão de app/comercial/page.tsx, mas com o nome
 * de parâmetro `tab` (não `aba`) porque o pedido explicitou esse exemplo de
 * URL (`/resumo?tab=comercial`). */
export default function ResumoPage() {
  return (
    <Suspense fallback={null}>
      <ResumoPageConteudo />
    </Suspense>
  );
}

function ResumoPageConteudo() {
  const searchParams = useSearchParams();
  const [aba, setAba] = useState<AbaResumo>("geral");

  useEffect(() => {
    const abaUrl = searchParams.get("tab") as AbaResumo | null;
    if (abaUrl && ABAS.some((a) => a.valor === abaUrl)) {
      setAba(abaUrl);
      return;
    }
    const salva = window.localStorage.getItem(CHAVE_ABA) as AbaResumo | null;
    if (salva && ABAS.some((a) => a.valor === salva)) setAba(salva);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function trocarAba(nova: AbaResumo) {
    setAba(nova);
    window.localStorage.setItem(CHAVE_ABA, nova);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", nova);
    window.history.replaceState(null, "", url);
  }

  const abaAtual = ABAS.find((a) => a.valor === aba) ?? ABAS[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Resumo</h1>
        <p className="text-sm text-gray-500">{abaAtual.subtitulo}</p>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {ABAS.map((a) => (
          <button
            key={a.valor}
            type="button"
            onClick={() => trocarAba(a.valor)}
            className={`rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
              aba === a.valor ? "border-b-2 border-brand bg-brand-light text-brand" : "text-gray-500 hover:bg-gray-50"
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>

      {aba === "geral" && <DashboardGeral />}
      {aba === "operacao" && <DashboardOperacao />}
      {aba === "comercial" && <DashboardComercial />}
      {aba === "financeira" && <DashboardFinanceira />}
    </div>
  );
}
