"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

/** Rota antiga de detalhe de lead — o detalhe agora é o LeadDetailModal
 * (slide-over) dentro da aba CRM de app/comercial/page.tsx, não mais uma
 * página própria. Mantido como um redirect fino (em vez de simplesmente
 * apagar a rota) para não quebrar links/favoritos antigos que ainda apontem
 * pra `/comercial/<id>` — `?lead=<id>` abre o modal automaticamente ao
 * carregar a aba CRM. */
export default function LeadDetalheRedirect() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  useEffect(() => {
    router.replace(`/comercial?lead=${id}`);
  }, [id, router]);

  return <p className="text-sm text-gray-500">Redirecionando...</p>;
}
