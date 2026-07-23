"use client";

import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/auth-store";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RegisterPage() {
  const router = useRouter();
  const loginWithGoogle = useAuthStore((s) => s.loginWithGoogle);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleGoogleRegister() {
    setError("");
    setLoading(true);
    try {
      const result = await loginWithGoogle();
      if (!result.ok && result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }
      if (!isSupabaseConfigured()) {
        router.push("/app");
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Erro ao iniciar autenticação."
      );
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
                Criar conta no Forum
              </h1>
            </div>

            <div className="p-6 sm:p-8">
              <p className="text-sm leading-relaxed text-neutral-600">
                Junte-se à comunidade Nullysh em apenas 1 clique usando sua conta do Google.
              </p>

              <div className="mt-6 space-y-4">
                {error && (
                  <p
                    role="alert"
                    className="rounded-xl border-2 border-red-200 bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-700"
                  >
                    {error}
                  </p>
                )}

                <Button
                  type="button"
                  onClick={handleGoogleRegister}
                  className="relative flex w-full items-center justify-center gap-3 rounded-xl border border-neutral-300 bg-white px-5 py-3.5 text-sm font-semibold text-neutral-800 shadow-sm transition-all hover:bg-neutral-50 hover:border-neutral-400 active:scale-[0.98] disabled:opacity-50"
                  size="lg"
                  loading={loading}
                >
                  {!loading && (
                    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                  )}
                  <span>{loading ? "Conectando ao Google..." : "Cadastrar com Google"}</span>
                </Button>
              </div>

              <div className="mt-6 rounded-xl border-2 border-dashed border-neutral-300 bg-[#f5f5f5] px-4 py-3 text-xs text-neutral-600">
                <p className="font-semibold text-black">Cadastro simplificado</p>
                <p className="mt-1.5 leading-relaxed">
                  Não é necessário guardar senhas adicionais. Seu perfil do Forum é vinculado com segurança à sua conta Google.
                </p>
              </div>
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
