"use client";

import { Carregando } from "@/components/ui/Esqueleto";
import { Suspense, useCallback, useEffect, useState } from "react";
import CabecalhoPagina from "@/components/ui/CabecalhoPagina";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Trash2 } from "lucide-react";
import FormFuncionario from "@/components/modules/rh/FormFuncionario";
import FuncionarioAnexos from "@/components/modules/rh/FuncionarioAnexos";
import EpisFuncionario from "@/components/modules/rh/EpisFuncionario";
import AusenciasFuncionario from "@/components/modules/rh/AusenciasFuncionario";
import HistoricoFuncionario from "@/components/modules/rh/HistoricoFuncionario";
import { useConfigRh } from "@/components/modules/rh/useConfigRh";
import { toast } from "@/components/modules/rh/toast";
import { confirmar } from "@/components/ui/confirmar";
import { LABEL_VINCULO } from "@/lib/rh";
import type { Funcionario, FuncionarioDados } from "@/lib/types/domain";

const ABAS = [
  { valor: "dados", label: "Dados" },
  { valor: "documentos", label: "Documentos" },
  { valor: "epi", label: "EPI" },
  { valor: "ausencias", label: "Férias e afastamentos" },
  { valor: "historico", label: "Pagamentos e obras" },
] as const;
type Aba = (typeof ABAS)[number]["valor"];

const LABEL_STATUS: Record<string, string> = { ativo: "Ativo", inativo: "Inativo", desligado: "Desligado" };

/** Ficha do funcionário em página própria (migração 052) — antes era um
 * popup estreito com os documentos no fim. Abas: dados, documentos, EPI,
 * férias/afastamentos e pagamentos/obras. A aba fica no endereço (?aba=)
 * para dar para voltar direto nela. */
export default function FichaFuncionarioPage() {
  return (
    <Suspense fallback={<Carregando />}>
      <FichaFuncionario />
    </Suspense>
  );
}

function FichaFuncionario() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const busca = useSearchParams();
  const aba = (ABAS.some((a) => a.valor === busca.get("aba")) ? busca.get("aba") : "dados") as Aba;
  const { config } = useConfigRh();
  const [funcionario, setFuncionario] = useState<(Funcionario & { dados: FuncionarioDados | null }) | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const r = await fetch(`/api/rh/funcionarios/${id}`).then((x) => x.json()).catch(() => null);
    if (r?.success) setFuncionario(r.data);
    else setErro(r?.error ?? "Não foi possível abrir a ficha.");
  }, [id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function excluir() {
    if (!funcionario) return;
    if (!(await confirmar(`Excluir o funcionário "${funcionario.nome}"? Documentos, EPI e afastamentos dele também são apagados.`))) return;
    const r = await fetch(`/api/rh/funcionarios/${id}`, { method: "DELETE" }).then((x) => x.json());
    if (!r.success) return toast.erro(r.error ?? "Não foi possível excluir.");
    toast.sucesso("Funcionário excluído.");
    router.push("/rh/funcionarios");
  }

  if (erro) return <p className="text-sm text-status-error">{erro}</p>;
  if (!funcionario) return <Carregando />;

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo={funcionario.nome}
        voltar={{ href: "/rh/funcionarios", label: "Funcionários" }}
        descricao={[funcionario.numero_funcionario, funcionario.cargo, funcionario.vinculo ? LABEL_VINCULO[funcionario.vinculo] : null, LABEL_STATUS[funcionario.status]]
          .filter(Boolean)
          .join(" · ")}
        acoes={[{ label: "Excluir funcionário", icone: <Trash2 className="icone" aria-hidden />, perigo: true, onClick: excluir }]}
      />

      <nav className="-mx-4 flex gap-1 overflow-x-auto border-b border-gray-200 px-4 [scrollbar-width:none] sm:mx-0 sm:px-0" aria-label="Seções da ficha">
        {ABAS.map((a) => (
          <Link
            key={a.valor}
            href={`/rh/funcionarios/${id}${a.valor === "dados" ? "" : `?aba=${a.valor}`}`}
            replace
            scroll={false}
            className={`shrink-0 whitespace-nowrap rounded-t-lg px-4 py-2 font-montserrat text-sm font-semibold ${
              aba === a.valor ? "border-b-2 border-brand bg-brand-light text-brand" : "text-gray-500 hover:bg-gray-50"
            }`}
            aria-current={aba === a.valor ? "page" : undefined}
          >
            {a.label}
          </Link>
        ))}
      </nav>

      {aba === "dados" && <FormFuncionario funcionario={funcionario} onSalvo={() => carregar()} />}
      {aba === "documentos" && (
        <FuncionarioAnexos funcionarioId={funcionario.id} tiposDocumento={config?.tiposDocumento ?? []} diasAviso={config?.diasAviso ?? 30} />
      )}
      {aba === "epi" && <EpisFuncionario funcionario={funcionario} />}
      {aba === "ausencias" && <AusenciasFuncionario funcionarioId={funcionario.id} />}
      {aba === "historico" && <HistoricoFuncionario funcionarioId={funcionario.id} />}
    </div>
  );
}
