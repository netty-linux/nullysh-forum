"use client";

import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/lib/auth-store";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = login(email, password);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push("/app");
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-white">
      <div className="border-b border-neutral-200/80 px-4 py-4 sm:px-6">
        <Logo />
      </div>
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-950">
            Entrar no Forum
          </h1>
          <p className="mt-2 text-sm text-neutral-500">
            Acesse sua conta para o feed, comunidades e materiais.
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <Input
              label="E-mail"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="voce@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              label="Senha"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {error && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>

          <div className="mt-6 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-xs text-neutral-500">
            <p className="font-medium text-neutral-700">Contas de demo</p>
            <p className="mt-1">Admin VIP: admin@nullysh.com / admin123</p>
            <p>Membro free: demo@nullysh.com / demo123</p>
          </div>

          <p className="mt-8 text-center text-sm text-neutral-500">
            Não tem conta?{" "}
            <Link
              href="/register"
              className="font-medium text-neutral-950 underline-offset-4 hover:underline"
            >
              Criar conta
            </Link>
          </p>

          <p className="mt-4 text-center text-xs text-neutral-400">
            OAuth Gmail e GitHub chegam na próxima etapa.
          </p>
        </div>
      </div>
    </div>
  );
}
