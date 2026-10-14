"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import FormFuncionario from "@/components/modules/rh/FormFuncionario";

/** Novo colaborador (migração 052): o cadastro abre na mesma ficha em página
 * própria; ao salvar, segue para a aba de Documentos para anexar ASO, NRs... */
export default function NovoFuncionarioPage() {
  const router = useRouter();
  return (
    <div className="space-y-6">
      <div>
        <Link href="/rh/funcionarios" className="text-sm text-brand hover:underline">
          ← Funcionários
        </Link>
        <h1 className="text-2xl font-bold">Novo colaborador</h1>
        <p className="text-sm text-gray-500">Depois de cadastrar, a ficha abre na aba de Documentos para anexar ASO, NRs e certificados.</p>
      </div>
      <FormFuncionario funcionario={null} onSalvo={(f) => router.push(`/rh/funcionarios/${f.id}?aba=documentos`)} />
    </div>
  );
}
