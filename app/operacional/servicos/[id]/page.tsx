"use client";

import { useParams, useRouter } from "next/navigation";
import ServicoDetailModal from "@/components/modules/operacional/ServicoDetailModal";

/** Ficha da obra em página própria (revisão de usabilidade) — antes era um
 * painel lateral por cima do quadro de serviços. */
export default function ServicoPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  return (
    <div className="mx-auto max-w-4xl">
      <ServicoDetailModal servicoId={id} modo="pagina" onFechar={() => router.push("/operacional/servicos")} onServicoMudou={() => undefined} />
    </div>
  );
}
