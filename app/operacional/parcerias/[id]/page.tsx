import { redirect } from "next/navigation";

/** Endereço antigo: a ficha da parceria agora fica no Comercial. */
export default function Page({ params }: { params: { id: string } }) {
  redirect(`/comercial/parcerias/${params.id}`);
}
