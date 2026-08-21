"use client";

// Último recurso: captura erros que acontecem no próprio layout raiz (fora do
// alcance de app/error.tsx). Precisa renderizar <html>/<body> porque substitui o
// layout inteiro.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const isEnvError = error.message?.includes("Variável de ambiente");

  return (
    <html lang="pt-BR">
      <body>
        <div style={{ maxWidth: 512, margin: "80px auto", textAlign: "center", fontFamily: "Arial, sans-serif" }}>
          <h1 style={{ color: "#dc2626", fontSize: 20, fontWeight: 700 }}>Algo deu errado</h1>
          <p style={{ marginTop: 16, fontSize: 14, color: "#4b5563" }}>
            {isEnvError
              ? "As variáveis de ambiente do Supabase não estão configuradas neste ambiente. Configure-as em Vercel → Settings → Environment Variables e faça um novo deploy."
              : error.message || "Erro inesperado."}
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{ marginTop: 24, padding: "8px 16px", background: "#198754", color: "#fff", borderRadius: 8 }}
          >
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  );
}
