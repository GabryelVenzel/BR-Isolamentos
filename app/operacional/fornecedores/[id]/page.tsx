"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ModalFornecedor from "@/components/modules/operacional/ModalFornecedor";
import CabecalhoPagina from "@/components/ui/CabecalhoPagina";
import FichaAbas, { useAbaAtual } from "@/components/FichaAbas";
import ListaVinculados from "@/components/ListaVinculados";
import { EsqueletoCartao } from "@/components/ui/Esqueleto";
import { formatarData, formatarMoeda } from "@/lib/format";
import type { Fornecedor, LancamentoFinanceiro } from "@/lib/types/domain";

/** Ficha do fornecedor em página própria (revisão de usabilidade): dados e
 * documentos e as compras/pagamentos lançados para ele. */
export default function FornecedorPage() {
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
  const [parceiro, setParceiro] = useState<Fornecedor | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [lancamentos, setLancamentos] = useState<LancamentoFinanceiro[] | null>(null);

  const carregar = useCallback(async () => {
    const r = await fetch(`/api/operacional/fornecedores/${id}`).then((x) => x.json()).catch(() => null);
    if (r?.success) setParceiro(r.data);
    else setErro(r?.error ?? "Não foi possível abrir o fornecedor.");
  }, [id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    if (aba === "pagamentos" && lancamentos === null)
      fetch(`/api/financeiro/lancamentos?fornecedor_id=${id}`).then((x) => x.json()).then((r) => setLancamentos(r?.success ? r.data : [])).catch(() => setLancamentos([]));
  }, [aba, id, lancamentos]);

  if (erro) return <p className="text-sm text-status-error">{erro}</p>;
  if (!parceiro) return <EsqueletoCartao linhas={8} />;

  return (
    <div>
      <CabecalhoPagina titulo={parceiro.nome} voltar={{ href: "/operacional/fornecedores", label: "Fornecedores" }} />
      <FichaAbas
        abas={[
          { valor: "dados", label: "Dados e documentos" },
          { valor: "pagamentos", label: "Pagamentos" },
        ]}
      />
      {aba === "dados" && <ModalFornecedor fornecedor={parceiro} modo="pagina" onFechar={() => router.push("/operacional/fornecedores")} onSalvo={carregar} />}
      {aba === "pagamentos" && (
        <ListaVinculados
          titulo="Compras e pagamentos lançados no Financeiro"
          vazio="Nenhum lançamento ligado a este fornecedor (ou sem acesso ao Financeiro)."
          itens={lancamentos && lancamentos.map((l) => ({ id: l.id, titulo: l.descricao || l.categoria, detalhe: `${formatarData(l.data)} · ${l.pago ? "pago" : "em aberto"}`, direita: formatarMoeda(l.valor) }))}
        />
      )}
    </div>
  );
}
