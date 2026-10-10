"use client";

import { usePathname } from "next/navigation";
import { classeLargura } from "@/lib/largura";

/** Área principal de toda página — só existe como componente de cliente
 * porque a largura depende da rota (ver lib/largura.ts). */
export default function Conteudo({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return <main className={`mx-auto w-full flex-1 px-4 py-8 ${classeLargura(pathname)}`}>{children}</main>;
}
