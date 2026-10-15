import FichaParceiro from "@/components/modules/operacional/FichaParceiro";

/** Endereço antigo da ficha: abre e redireciona para a subaba certa
 * (Prestadores ou Parcerias) assim que sabe a categoria. */
export default function Page() {
  return <FichaParceiro categoria="prestador" />;
}
