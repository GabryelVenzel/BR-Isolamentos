"use client";

import { useParams, useRouter } from "next/navigation";
import LeadDetailModal from "@/components/modules/comercial/LeadDetailModal";
import ValorFechadoHost from "@/components/modules/comercial/ValorFechado";

/** Ficha do lead em página própria (revisão de usabilidade) — antes era um
 * painel lateral por cima do quadro. Tem endereço próprio (dá para mandar o
 * link) e o "voltar" do navegador funciona. */
export default function LeadPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  return (
    <div className="mx-auto max-w-4xl">
      <LeadDetailModal leadId={id} modo="pagina" onFechar={() => router.push("/comercial")} onLeadMudou={() => undefined} />
      <ValorFechadoHost />
    </div>
  );
}
