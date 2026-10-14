"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp } from "lucide-react";
import MenuAcoes, { type AcaoMenu } from "@/components/ui/MenuAcoes";
import { formatarData, formatarMoeda, classesStatus, formatarStatus } from "@/lib/format";
import type { Orcamento } from "@/lib/types";

interface Props {
  orcamentos: Orcamento[];
  onExcluir?: (id: number) => void;
}

type Campo = "numero" | "cliente" | "data" | "status" | "valor";

/** Linhas mostradas por vez — "Carregar mais" traz o próximo bloco. */
const POR_VEZ = 50;

/** Revisão de usabilidade: a linha inteira abre o orçamento; Editar, PDF e
 * Excluir ficam no menu "⋯"; colunas ordenáveis; no celular cada orçamento
 * vira um cartão compacto; a lista vem em blocos ("Carregar mais"). */
export default function TableOrcamentos({ orcamentos, onExcluir }: Props) {
  const router = useRouter();
  const [ordem, setOrdem] = useState<{ campo: Campo; asc: boolean }>({ campo: "data", asc: false });
  const [limite, setLimite] = useState(POR_VEZ);

  const ordenados = useMemo(() => {
    const sinal = ordem.asc ? 1 : -1;
    const chave = (o: Orcamento): string | number => {
      switch (ordem.campo) {
        case "numero":
          return o.numero ?? "";
        case "cliente":
          return o.cliente?.nome ?? "";
        case "status":
          return formatarStatus(o.status);
        case "valor":
          return Number(o.valor_final) || 0;
        default:
          return o.data_criacao ?? "";
      }
    };
    return [...orcamentos].sort((a, b) => {
      const ka = chave(a);
      const kb = chave(b);
      const c = typeof ka === "number" && typeof kb === "number" ? ka - kb : String(ka).localeCompare(String(kb), "pt-BR");
      return c * sinal;
    });
  }, [orcamentos, ordem]);

  if (orcamentos.length === 0) {
    return <div className="card text-center text-sm text-gray-500">Nenhum orçamento encontrado.</div>;
  }

  const visiveis = ordenados.slice(0, limite);

  const acoesDe = (o: Orcamento): AcaoMenu[] => [
    { label: "Abrir", href: `/orcamento/${o.id}` },
    { label: "Editar", href: `/orcamento/${o.id}/editar` },
    { label: "Baixar PDF", href: `/orcamento/${o.id}/download-pdf` },
    ...(onExcluir ? [{ label: "Excluir", perigo: true, onClick: () => onExcluir(o.id) }] : []),
  ];

  function ordenarPor(campo: Campo) {
    setOrdem((o) => (o.campo === campo ? { campo, asc: !o.asc } : { campo, asc: campo !== "data" && campo !== "valor" }));
  }

  const Cabecalho = ({ campo, children, direita }: { campo: Campo; children: React.ReactNode; direita?: boolean }) => (
    <th className={`px-4 py-3 ${direita ? "text-right" : "text-left"}`} aria-sort={ordem.campo === campo ? (ordem.asc ? "ascending" : "descending") : undefined}>
      <button type="button" className="inline-flex items-center gap-1 uppercase hover:underline" onClick={() => ordenarPor(campo)}>
        {children}
        {ordem.campo === campo && (ordem.asc ? <ArrowUp className="h-3.5 w-3.5" aria-hidden /> : <ArrowDown className="h-3.5 w-3.5" aria-hidden />)}
      </button>
    </th>
  );

  return (
    <div className="space-y-3">
      {/* Celular: cartão compacto; tocar abre o orçamento. */}
      <ul className="space-y-2 md:hidden">
        {visiveis.map((o) => (
          <li key={o.id} className="card flex items-start gap-2 p-3">
            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => router.push(`/orcamento/${o.id}`)}>
              <span className="flex items-start justify-between gap-2">
                <span className="min-w-0 truncate font-semibold text-gray-800">{o.cliente?.nome ?? "Sem cliente"}</span>
                <span className="shrink-0 font-semibold text-brand">{formatarMoeda(o.valor_final)}</span>
              </span>
              <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                <span className="font-medium text-brand">{o.numero}</span>
                {o.numero_orcamento && <span>{o.numero_orcamento}</span>}
                <span>{formatarData(o.data_criacao)}</span>
                <span className={`badge ${classesStatus(o.status)}`}>{formatarStatus(o.status)}</span>
              </span>
            </button>
            <MenuAcoes discreto acoes={acoesDe(o)} />
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto rounded-xl border border-gray-200 bg-white md:block">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="table-header">
            <tr>
              <Cabecalho campo="numero">Número</Cabecalho>
              <Cabecalho campo="cliente">Cliente</Cabecalho>
              <Cabecalho campo="data">Data</Cabecalho>
              <Cabecalho campo="status">Status</Cabecalho>
              <Cabecalho campo="valor" direita>
                Valor Final
              </Cabecalho>
              <th className="px-4 py-3">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {visiveis.map((orcamento) => (
              <tr key={orcamento.id} className="cursor-pointer hover:bg-gray-50" onClick={() => router.push(`/orcamento/${orcamento.id}`)}>
                <td className="px-4 py-3 font-medium text-brand">
                  {orcamento.numero}
                  {/* Código interno (O00038) — é o que aparece em Comercial
                      (vincular ao lead) e em Operacional (serviços). */}
                  {orcamento.numero_orcamento && <span className="block text-xs font-normal text-gray-400">{orcamento.numero_orcamento}</span>}
                </td>
                <td className="px-4 py-3">{orcamento.cliente?.nome ?? "—"}</td>
                <td className="px-4 py-3">{formatarData(orcamento.data_criacao)}</td>
                <td className="px-4 py-3">
                  <span className={`badge ${classesStatus(orcamento.status)}`}>{formatarStatus(orcamento.status)}</span>
                </td>
                <td className="px-4 py-3 text-right font-medium">{formatarMoeda(orcamento.valor_final)}</td>
                <td className="px-2 py-1 text-right" onClick={(e) => e.stopPropagation()}>
                  <MenuAcoes discreto acoes={acoesDe(orcamento)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {ordenados.length > limite && (
        <div className="flex flex-col items-center gap-1">
          <button type="button" className="btn-secondary" onClick={() => setLimite((n) => n + POR_VEZ)}>
            Carregar mais ({ordenados.length - limite} restantes)
          </button>
          <span className="text-xs text-gray-400">
            Mostrando {limite} de {ordenados.length}
          </span>
        </div>
      )}
    </div>
  );
}
