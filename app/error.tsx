"use client";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const isEnvError = error.message?.includes("Variável de ambiente");

  return (
    <div className="mx-auto max-w-lg py-20 text-center">
      <h1 className="font-montserrat text-xl font-bold text-status-error">Algo deu errado</h1>

      {isEnvError ? (
        <p className="mt-4 text-sm text-gray-600">
          As variáveis de ambiente do Supabase (<code>NEXT_PUBLIC_SUPABASE_URL</code> e{" "}
          <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>) não estão configuradas neste ambiente.
          Configure-as em Vercel → Settings → Environment Variables (ambiente Production) e
          faça um novo deploy.
        </p>
      ) : (
        <p className="mt-4 text-sm text-gray-600">{error.message || "Erro inesperado."}</p>
      )}

      <button type="button" onClick={() => reset()} className="btn-primary mt-6">
        Tentar novamente
      </button>
    </div>
  );
}
