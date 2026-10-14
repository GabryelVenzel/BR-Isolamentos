"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ModalCliente from "@/components/modules/comercial/ModalCliente";
import CabecalhoPagina from "@/components/ui/CabecalhoPagina";
import FichaAbas, { useAbaAtual } from "@/components/FichaAbas";
import ListaVinculados from "@/components/ListaVinculados";
import { EsqueletoCartao } from "@/components/ui/Esqueleto";
import { formatarData, formatarEtapa, formatarMoeda, formatarStatus } from "@/lib/format";
import type { Cliente, Orcamento } from "@/lib/types";
import type { Lead, Servico } from "@/lib/types/domain";

/** Ficha do cliente em página própria (revisão de usabilidade): dados,
 * leads, orçamentos e obras dele. */
export default function ClientePage() {
  return (
    <Suspense fallback={<EsqueletoCartao />}>
      <Ficha />
    </Suspense>
  );
}

function Ficha() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const aba = useAbaAtual("dados");
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [orcamentos, setOrcamentos] = useState<Orcamento[] | null>(null);
  const [obras, setObras] = useState<Servico[] | null>(null);

  const carregar = useCallback(async () => {
    const r = await fetch(`/api/clientes/${id}`).then(async (x) => ({ ok: x.ok, corpo: await x.json() })).catch(() => null);
    if (r?.ok) setCliente(r.corpo);
    else setErro(r?.corpo?.error ?? "Não foi possível abrir o cliente.");
  }, [id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    if (aba === "leads" && leads === null)
      fetch("/api/comercial/leads").then((x) => x.json()).then((r) => setLeads((r?.success ? (r.data as Lead[]) : []).filter((l) => String(l.cliente_id) === id))).catch(() => setLeads([]));
    if (aba === "orcamentos" && orcamentos === null)
      fetch(`/api/orcamentos?cliente_id=${id}`).then((x) => x.json()).then((r) => setOrcamentos(Array.isArray(r) ? r : [])).catch(() => setOrcamentos([]));
    if (aba === "obras" && obras === null)
      fetch("/api/operacional/servicos").then((x) => x.json()).then((r) => setObras((r?.success ? (r.data as Servico[]) : []).filter((s) => String(s.cliente_id) === id))).catch(() => setObras([]));
  }, [aba, id, leads, orcamentos, obras]);

  if (erro) return <p className="text-sm text-status-error">{erro}</p>;
  if (!cliente) return <EsqueletoCartao linhas={8} />;

  return (
    <div>
      <CabecalhoPagina titulo={cliente.nome} descricao={cliente.razao_social ?? undefined} voltar={{ href: "/comercial?aba=clientes", label: "Clientes" }} />
      <FichaAbas
        abas={[
          { valor: "dados", label: "Dados" },
          { valor: "leads", label: "Leads" },
          { valor: "orcamentos", label: "Orçamentos" },
          { valor: "obras", label: "Obras" },
        ]}
      />
      {aba === "dados" && <ModalCliente cliente={cliente} modo="pagina" onFechar={() => router.push("/comercial?aba=clientes")} onSalvo={carregar} />}
      {aba === "leads" && (
        <ListaVinculados
          titulo="Leads"
          vazio="Nenhum lead deste cliente."
          itens={leads && leads.map((l) => ({ id: l.id, href: `/comercial/leads/${l.id}`, titulo: l.numero_lead ?? "Lead", detalhe: `${formatarEtapa(l.etapa)} · ${formatarData(l.created_at)}`, direita: l.valor_estimado ? formatarMoeda(l.valor_estimado) : null }))}
        />
      )}
      {aba === "orcamentos" && (
        <ListaVinculados
          titulo="Orçamentos"
          vazio="Nenhum orçamento deste cliente."
          itens={orcamentos && orcamentos.map((o) => ({ id: String(o.id), href: `/orcamento/${o.id}`, titulo: o.numero, detalhe: `${formatarStatus(o.status)} · ${formatarData(o.data_criacao)}`, direita: formatarMoeda(o.valor_final) }))}
        />
      )}
      {aba === "obras" && (
        <ListaVinculados
          titulo="Obras"
          vazio="Nenhuma obra deste cliente."
          itens={obras && obras.map((s) => ({ id: s.id, href: `/operacional/servicos/${s.id}`, titulo: s.numero_servico, detalhe: s.data_inicio ? formatarData(s.data_inicio) : null, direita: s.valor_orcado != null ? formatarMoeda(s.valor_orcado) : null }))}
        />
      )}
    </div>
  );
}
