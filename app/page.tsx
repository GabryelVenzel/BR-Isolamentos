import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatarMoeda } from "@/lib/format";
import TableOrcamentos from "@/components/TableOrcamentos";
import DashboardChart from "@/components/DashboardChart";
import type { Orcamento } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("orcamentos")
    .select("*, cliente:clientes(*)")
    .order("criado_em", { ascending: false });

  const orcamentos = (data ?? []) as Orcamento[];

  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);

  const doMes = orcamentos.filter((o) => new Date(o.criado_em) >= inicioMes);
  const totalMes = doMes.reduce((acc, o) => acc + o.valor_final, 0);
  const ticketMedio = orcamentos.length > 0
    ? orcamentos.reduce((acc, o) => acc + o.valor_final, 0) / orcamentos.length
    : 0;
  const aceitos = orcamentos.filter((o) => o.status === "aceito").length;
  const enviados = orcamentos.filter((o) => ["enviado", "aceito", "rejeitado"].includes(o.status)).length;
  const conversao = enviados > 0 ? (aceitos / enviados) * 100 : 0;

  const totaisPorMes = new Map<string, number>();
  for (const o of orcamentos) {
    const data = new Date(o.criado_em);
    const chave = data.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
    totaisPorMes.set(chave, (totaisPorMes.get(chave) ?? 0) + o.valor_final);
  }
  const dadosGrafico = Array.from(totaisPorMes.entries())
    .slice(-6)
    .map(([mes, total]) => ({ mes, total }));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-gray-500">Visão geral dos orçamentos de isolamento térmico.</p>
        </div>
        <Link href="/novo-orcamento" className="btn-primary">
          + Novo Orçamento
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <p className="text-xs font-medium uppercase text-gray-500">Total de Orçamentos</p>
          <p className="mt-2 text-2xl font-bold">{orcamentos.length}</p>
        </div>
        <div className="card">
          <p className="text-xs font-medium uppercase text-gray-500">Total no Mês</p>
          <p className="mt-2 text-2xl font-bold">{formatarMoeda(totalMes)}</p>
        </div>
        <div className="card">
          <p className="text-xs font-medium uppercase text-gray-500">Ticket Médio</p>
          <p className="mt-2 text-2xl font-bold">{formatarMoeda(ticketMedio)}</p>
        </div>
        <div className="card">
          <p className="text-xs font-medium uppercase text-gray-500">Conversão</p>
          <p className="mt-2 text-2xl font-bold">{conversao.toFixed(1)}%</p>
        </div>
      </div>

      {dadosGrafico.length > 0 && <DashboardChart dados={dadosGrafico} />}

      <div>
        <h2 className="mb-3 text-lg font-semibold">Orçamentos recentes</h2>
        <TableOrcamentos orcamentos={orcamentos.slice(0, 10)} />
      </div>
    </div>
  );
}
