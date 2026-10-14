"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ModalParceiro from "@/components/modules/operacional/ModalParceiro";
import CabecalhoPagina from "@/components/ui/CabecalhoPagina";
import FichaAbas, { useAbaAtual } from "@/components/FichaAbas";
import ListaVinculados from "@/components/ListaVinculados";
import { EsqueletoCartao } from "@/components/ui/Esqueleto";
import { formatarData, formatarMoeda } from "@/lib/format";
import type { LancamentoFinanceiro, Parceiro, Servico } from "@/lib/types/domain";

/** Ficha do parceiro em página própria (revisão de usabilidade): dados e
 * documentos, obras em que atuou e pagamentos lançados para ele. */
export default function ParceiroPage() {
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
  const [parceiro, setParceiro] = useState<Parceiro | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [obras, setObras] = useState<Servico[] | null>(null);
  const [lancamentos, setLancamentos] = useState<LancamentoFinanceiro[] | null>(null);

  const carregar = useCallback(async () => {
    const r = await fetch(`/api/operacional/parceiros/${id}`).then((x) => x.json()).catch(() => null);
    if (r?.success) setParceiro(r.data);
    else setErro(r?.error ?? "Não foi possível abrir o parceiro.");
  }, [id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    if (aba === "obras" && obras === null)
      fetch(`/api/operacional/parceiros/${id}/servicos`).then((x) => x.json()).then((r) => setObras(r?.success ? r.data : [])).catch(() => setObras([]));
    if (aba === "pagamentos" && lancamentos === null)
      fetch(`/api/financeiro/lancamentos?parceiro_id=${id}`).then((x) => x.json()).then((r) => setLancamentos(r?.success ? r.data : [])).catch(() => setLancamentos([]));
  }, [aba, id, obras, lancamentos]);

  if (erro) return <p className="text-sm text-status-error">{erro}</p>;
  if (!parceiro) return <EsqueletoCartao linhas={8} />;

  return (
    <div>
      <CabecalhoPagina titulo={parceiro.nome} voltar={{ href: "/operacional/parceiros", label: "Parceiros" }} />
      <FichaAbas
        abas={[
          { valor: "dados", label: "Dados e documentos" },
          { valor: "obras", label: "Obras" },
          { valor: "pagamentos", label: "Pagamentos" },
        ]}
      />
      {aba === "dados" && <ModalParceiro parceiro={parceiro} modo="pagina" onFechar={() => router.push("/operacional/parceiros")} onSalvo={carregar} />}
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
