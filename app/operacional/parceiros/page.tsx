import { redirect } from "next/navigation";

/** Parceiros virou duas subabas (migração 053): Prestadores e Parcerias. */
export default function Page() {
  redirect("/operacional/prestadores");
}
