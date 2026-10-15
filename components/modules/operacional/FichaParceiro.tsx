"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ModalParceiro from "@/components/modules/operacional/ModalParceiro";
import CabecalhoPagina from "@/components/ui/CabecalhoPagina";
import FichaAbas, { useAbaAtual } from "@/components/FichaAbas";
import ListaVinculados from "@/components/ListaVinculados";
import { EsqueletoCartao } from "@/components/ui/Esqueleto";
import { formatarData, formatarEtapa, formatarMoeda, formatarNumero } from "@/lib/format";
import { comissaoRepresentante, valorBrutoDoLead } from "@/lib/leads";
import type { CategoriaParceiro, LancamentoFinanceiro, Lead, Parceiro, Servico } from "@/lib/types/domain";

// Volta para a lista (no Comercial, a lista é uma aba da página /comercial).
const BASE: Record<CategoriaParceiro, { href: string; label: string; ficha: string }> = {
  prestador: { href: "/operacional/prestadores", label: "Prestadores", ficha: "/operacional/prestadores" },
  parceria: { href: "/comercial?aba=parcerias", label: "Parcerias", ficha: "/comercial/parcerias" },
  representante: { href: "/comercial?aba=representantes", label: "Representantes", ficha: "/comercial/representantes" },
};

/** Ficha de prestador ou parceria em página própria: dados e documentos,
 * obras em que atuou (prestador) ou leads que indicou (parceria), e os
 * pagamentos lançados para ele. */
export default function FichaParceiro({ categoria }: { categoria: CategoriaParceiro }) {
  return (
    <Suspense fallback={<EsqueletoCartao />}>
      <Ficha categoria={categoria} />
    </Suspense>
  );
}

function Ficha({ categoria }: { categoria: CategoriaParceiro }) {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const aba = useAbaAtual("dados");
  const [parceiro, setParceiro] = useState<Parceiro | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [obras, setObras] = useState<Servico[] | null>(null);
  const [lancamentos, setLancamentos] = useState<LancamentoFinanceiro[] | null>(null);
  const [indicacoes, setIndicacoes] = useState<Lead[] | null>(null);

  const carregar = useCallback(async () => {
    const r = await fetch(`/api/operacional/parceiros/${id}`).then((x) => x.json()).catch(() => null);
    if (r?.success) {
      setParceiro(r.data);
      // Aberto pela aba errada (ex.: link antigo): vai para a certa.
      if (r.data.categoria_parceiro !== categoria) router.replace(`${BASE[r.data.categoria_parceiro as CategoriaParceiro].ficha}/${id}`);
    }
    else setErro(r?.error ?? "Não foi possível abrir o parceiro.");
  }, [id, categoria, router]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    if (aba === "obras" && obras === null)
      fetch(`/api/operacional/parceiros/${id}/servicos`).then((x) => x.json()).then((r) => setObras(r?.success ? r.data : [])).catch(() => setObras([]));
    if (aba === "pagamentos" && lancamentos === null)
      fetch(`/api/financeiro/lancamentos?parceiro_id=${id}`).then((x) => x.json()).then((r) => setLancamentos(r?.success ? r.data : [])).catch(() => setLancamentos([]));
    if ((aba === "indicacoes" || aba === "vendas") && indicacoes === null)
      fetch("/api/comercial/leads")
        .then((x) => x.json())
        .then((r) => setIndicacoes((r?.success ? (r.data as Lead[]) : []).filter((l) => (categoria === "representante" ? l.representante_id === id : l.parceiro_id === id))))
        .catch(() => setIndicacoes([]));
  }, [aba, id, obras, lancamentos, indicacoes, categoria]);

  const base = BASE[categoria];

  if (erro) return <p className="text-sm text-status-error">{erro}</p>;
  if (!parceiro) return <EsqueletoCartao linhas={8} />;

  return (
    <div>
      <CabecalhoPagina titulo={parceiro.nome} voltar={base} />
      <FichaAbas
        abas={[
          { valor: "dados", label: "Dados e documentos" },
          categoria === "prestador"
            ? { valor: "obras", label: "Obras" }
            : categoria === "representante"
              ? { valor: "vendas", label: "Vendas" }
              : { valor: "indicacoes", label: "Indicações" },
          { valor: "pagamentos", label: "Pagamentos" },
        ]}
      />
      {aba === "dados" && <ModalParceiro parceiro={parceiro} modo="pagina" onFechar={() => router.push(base.href)} onSalvo={carregar} />}
      {aba === "vendas" && (
        <ListaVinculados
          titulo="Leads e vendas do representante"
          vazio="Nenhum lead deste representante ainda."
          itens={
            indicacoes &&
            indicacoes.map((l) => ({
              id: l.id,
              href: `/comercial/leads/${l.id}`,
              titulo: `${l.numero_lead ?? "Lead"}${l.cliente?.nome ? ` · ${l.cliente.nome}` : ""}`,
              detalhe: `${formatarEtapa(l.etapa)} · ${formatarMoeda(valorBrutoDoLead(l))} · comissão ${formatarNumero(Number(l.percentual_representante ?? 0), 2)}%`,
              direita: formatarMoeda(comissaoRepresentante(l)),
            }))
          }
        />
      )}
      {aba === "indicacoes" && (
        <ListaVinculados
          titulo="Leads indicados"
          vazio="Nenhuma indicação ainda (ou sem acesso ao Comercial)."
          itens={
            indicacoes &&
            indicacoes.map((l) => ({
              id: l.id,
              href: `/comercial/leads/${l.id}`,
              titulo: `${l.numero_lead ?? "Lead"}${l.cliente?.nome ? ` · ${l.cliente.nome}` : ""}`,
              detalhe: `${formatarEtapa(l.etapa)} · ${formatarData(l.created_at)}`,
              direita: l.valor_comissao ? formatarMoeda(l.valor_comissao) : null,
            }))
          }
        />
      )}
      {aba === "obras" && (
        <ListaVinculados
          titulo="Obras em que atuou"
          vazio="Nenhuma obra ainda."
          itens={
            obras &&
            obras.map((s) => ({
              id: s.id,
              href: `/operacional/servicos/${s.id}`,
              titulo: `${s.numero_servico}${s.cliente?.nome ? ` · ${s.cliente.nome}` : ""}`,
              detalhe: [s.data_inicio && formatarData(s.data_inicio), s.data_fim_prevista && `até ${formatarData(s.data_fim_prevista)}`].filter(Boolean).join(" "),
            }))
          }
        />
      )}
      {aba === "pagamentos" && (
        <ListaVinculados
          titulo="Pagamentos lançados no Financeiro"
          vazio="Nenhum lançamento ligado a este parceiro (ou sem acesso ao Financeiro)."
          itens={lancamentos && lancamentos.map((l) => ({ id: l.id, titulo: l.descricao || l.categoria, detalhe: `${formatarData(l.data)} · ${l.pago ? "pago" : "em aberto"}`, direita: formatarMoeda(l.valor) }))}
        />
      )}
    </div>
  );
}
