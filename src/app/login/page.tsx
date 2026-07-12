"use client";

import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/lib/auth-store";
import { isSupabaseConfigured } from "@/lib/supabase/config";
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

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await login(email, password);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/app");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#ebebeb]">
      {/* Barra preta de marca - contraste óbvio */}
      <div className="h-1.5 w-full bg-black" />
      <div className="border-b border-neutral-300 bg-white px-4 py-4 sm:px-6">
        <Logo />
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-12 sm:py-16">
        <div className="app-page w-full max-w-[440px]">
          <div className="overflow-hidden rounded-2xl border border-neutral-300 bg-white shadow-[0_20px_50px_-20px_rgba(0,0,0,0.25)]">
            <div className="border-b border-neutral-200 bg-black px-6 py-5 text-white sm:px-8">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-400">
                Acesso
              </p>
              <h1 className="mt-1.5 text-2xl font-semibold tracking-tight">
                Entrar no Forum
              </h1>
            </div>

            <div className="p-6 sm:p-8">
              <p className="text-sm leading-relaxed text-neutral-600">
                Acesse sua conta para o feed, assuntos e materiais.
              </p>

              <form onSubmit={onSubmit} className="mt-6 space-y-4">
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
                  <p
                    role="alert"
                    className="rounded-xl border-2 border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                  >
                    {error}
                  </p>
                )}
                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  loading={loading}
                >
                  Entrar
                </Button>
              </form>

              <div className="mt-6 rounded-xl border-2 border-dashed border-neutral-300 bg-[#f5f5f5] px-4 py-3 text-xs text-neutral-600">
                {isSupabaseConfigured() ? (
                  <>
                    <p className="font-semibold text-black">Supabase Auth</p>
                    <p className="mt-1.5 leading-relaxed">
                      Sessão real no Supabase. Use o e-mail e senha do cadastro.
                      Contas só do MVP local (sem Supabase) não existem aqui.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-semibold text-black">Modo local (dev)</p>
                    <p className="mt-1.5 leading-relaxed">
                      Supabase não configurado. Seed de dev:{" "}
                      <code className="rounded bg-white px-1">admin@nullysh.com</code>{" "}
                      / <code className="rounded bg-white px-1">admin123</code>
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          <p className="mt-8 text-center text-sm text-neutral-600">
            Não tem conta?{" "}
            <Link
              href="/register"
              className="font-semibold text-black underline underline-offset-4"
            >
              Criar conta
            </Link>
          </p>
          <p className="mt-2 text-center text-xs text-neutral-500">
            OAuth Gmail e GitHub chegam na próxima etapa.
          </p>
        </div>
      </div>
    </div>
  );
}
