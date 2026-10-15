import { notFound } from "next/navigation";
import CalculadoraRapida from "@/components/modules/engenharia/CalculadoraRapida";

/** Subabas Quente e Frio da Engenharia (calculadora térmica rápida). */
export default function EngenhariaTipoPage({ params }: { params: { tipo: string } }) {
  if (params.tipo !== "quente" && params.tipo !== "frio") notFound();
  return <CalculadoraRapida key={params.tipo} tipo={params.tipo} />;
}
