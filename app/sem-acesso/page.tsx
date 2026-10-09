/** Destino de quem tem login válido mas está desativado ou sem nenhum módulo
 * liberado (ver middleware.ts). A barra superior continua visível, com o
 * botão "Sair". */
export default function SemAcessoPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="card w-full max-w-md text-center">
        <h1 className="mb-2 text-xl font-bold">Sem acesso liberado</h1>
        <p className="text-sm text-gray-500">
          Sua conta está ativa no login, mas nenhum módulo do sistema está liberado para ela. Peça a um administrador para
          liberar o acesso em RH → Usuários.
        </p>
      </div>
    </div>
  );
}
