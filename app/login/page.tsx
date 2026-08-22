"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Logo from "@/components/Logo";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
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

      const redirectTo = searchParams.get("redirect") ?? "/resumo";
      router.push(redirectTo);
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
        <p className="mb-6 text-sm text-gray-500">
          Acesso restrito aos sócios cadastrados.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label-field" htmlFor="email">
              Usuário
            </label>
            <input
              id="email"
              type="text"
              required
              className="input-field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              placeholder="BR-ISOLAMENTO"
            />
          </div>

          <div>
            <label className="label-field" htmlFor="password">
              Senha
            </label>
            <input
              id="password"
              type="password"
              required
              className="input-field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          {erro && <p className="text-sm text-red-600">{erro}</p>}

          <button type="submit" className="btn-primary w-full" disabled={carregando}>
            {carregando ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
