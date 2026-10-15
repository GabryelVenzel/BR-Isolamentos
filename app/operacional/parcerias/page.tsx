import { redirect } from "next/navigation";

/** Parcerias saiu do Operacional para o Comercial (migração 055). */
export default function Page() {
  redirect("/comercial?aba=parcerias");
}
