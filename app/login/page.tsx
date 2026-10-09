"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Logo from "@/components/Logo";
import CampoSenha from "@/components/CampoSenha";
import { DOMINIO_EMAIL } from "@/lib/acesso";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

/** Só aceita destino interno ("/algo") — um `?redirect=https://...` montado
 * por terceiros não leva o usuário pra fora do sistema depois do login. */
function destinoSeguro(redirect: string | null): string | null {
  if (!redirect || !redirect.startsWith("/") || redirect.startsWith("//") || redirect === "/") return null;
  return redirect;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErro(null);
    setCarregando(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErro(data.error ?? "Não foi possível entrar.");
        return;
      }

      // Sem permissão pro destino pedido, o middleware manda pra primeira
      // tela liberada do usuário.
      router.push(destinoSeguro(searchParams.get("redirect")) ?? data.destino ?? "/");
      router.refresh();
    } catch {
      setErro("Erro de conexão. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center">
      <div className="card w-full max-w-sm">
        <Logo variant="navy" height={40} className="mb-4" />
        <p className="mb-6 text-sm text-gray-500">Acesso restrito à equipe BR Isolamentos.</p>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label className="label-field" htmlFor="email">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              required
              className="input-field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              placeholder={`nome@${DOMINIO_EMAIL}`}
            />
          </div>

          <CampoSenha id="password" label="Senha" value={password} onChange={setPassword} autoComplete="current-password" />

          {erro && (
            <p role="alert" className="rounded-input border border-red-200 bg-red-50 px-3 py-2 text-sm text-status-error">
              {erro}
            </p>
          )}

          <button type="submit" className="btn-primary w-full" disabled={carregando}>
            {carregando ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
