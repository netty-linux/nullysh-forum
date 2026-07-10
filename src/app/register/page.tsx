"use client";

import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/lib/auth-store";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function RegisterPage() {
  const router = useRouter();
  const register = useAuthStore((s) => s.register);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await register({ name, email, password });
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
      <div className="h-1.5 w-full bg-black" />
      <div className="border-b border-neutral-300 bg-white px-4 py-4 sm:px-6">
        <Logo />
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-12 sm:py-16">
        <div className="app-page w-full max-w-[440px]">
          <div className="overflow-hidden rounded-2xl border border-neutral-300 bg-white shadow-[0_20px_50px_-20px_rgba(0,0,0,0.25)]">
            <div className="border-b border-neutral-200 bg-black px-6 py-5 text-white sm:px-8">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-400">
                Cadastro
              </p>
              <h1 className="mt-1.5 text-2xl font-semibold tracking-tight">
                Criar conta
              </h1>
            </div>

            <div className="p-6 sm:p-8">
              <p className="text-sm leading-relaxed text-neutral-600">
                Conta na Nullysh Forum (Supabase Auth). Use um e-mail real.
              </p>

              <form onSubmit={onSubmit} className="mt-6 space-y-4">
                <Input
                  label="Nome"
                  name="name"
                  type="text"
                  autoComplete="name"
                  placeholder="Seu nome"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
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
                  autoComplete="new-password"
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  hint="Senha gerenciada pelo Supabase Auth (não fica em localStorage)."
                  required
                  minLength={6}
                />
                {error && (
                  <p
                    role="alert"
                    className="rounded-xl border-2 border-red-200 bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-700"
                  >
                    {error}
                  </p>
                )}
                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={loading}
                >
                  {loading ? "Criando..." : "Criar conta"}
                </Button>
              </form>
            </div>
          </div>

          <p className="mt-8 text-center text-sm text-neutral-600">
            Já tem conta?{" "}
            <Link
              href="/login"
              className="font-semibold text-black underline underline-offset-4"
            >
              Entrar
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
