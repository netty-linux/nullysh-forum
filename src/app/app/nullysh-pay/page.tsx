"use client";

/**
 * Nullysh Pay — bridge no Forum.
 * Dashboard do gateway vive no app externo (NULLYSH_PAY_URL).
 */

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { NULLYSH_PAY_BRAND, getNullyshPayUrl } from "@/lib/nullysh-pay/config";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { ArrowSquareOut, SpinnerGap } from "@phosphor-icons/react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NullyshPayBridgePage() {
  const { user, hydrated } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const firstName = user?.name?.trim().split(/\s+/)[0] || "";
  const payUrl = getNullyshPayUrl();

  async function continueWithForum() {
    if (!user) {
      router.push("/login?next=/app/nullysh-pay");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      // Sempre manda identidade do user logado no app (fallback se cookie falhar)
      const body = JSON.stringify({
        forumUserId: user.id,
        email: user.email,
        name: user.name,
        username: user.username,
      });

      if (isSupabaseConfigured()) {
        const sb = getSupabaseBrowser();
        if (sb) {
          // Garante token fresco (Workers não leem bem só cookie às vezes)
          try {
            await sb.auth.refreshSession();
          } catch {
            /* ignore */
          }
          const { data } = await sb.auth.getSession();
          const token = data.session?.access_token;
          if (token) {
            headers.Authorization = `Bearer ${token}`;
          }
        }
      }

      const res = await fetch("/api/nullysh-pay/sso", {
        method: "POST",
        headers,
        body,
        cache: "no-store",
        credentials: "same-origin",
      });
      const data = (await res.json()) as {
        ok?: boolean;
        redirectUrl?: string;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.redirectUrl) {
        setError(data.error || "Não foi possível abrir o Nullysh Pay.");
        return;
      }
      window.location.href = data.redirectUrl;
    } catch {
      setError("Falha de rede ao conectar com o Nullysh Pay.");
    } finally {
      setLoading(false);
    }
  }

  if (!hydrated) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-neutral-400">
        Carregando…
      </div>
    );
  }

  return (
    <div className="app-page mx-auto flex max-w-lg flex-col px-4 py-12 sm:px-6 sm:py-16">
      <div className="rounded-2xl border border-neutral-200/90 bg-white p-8 shadow-[0_1px_2px_rgb(0_0_0/0.04)] sm:p-10">
        <div className="flex flex-col items-center text-center">
          <span className="relative mb-4 flex h-16 w-16 items-center justify-center sm:h-20 sm:w-20">
            <Image
              src="/brand/nullysh-pay-logo.png"
              alt={NULLYSH_PAY_BRAND.name}
              width={80}
              height={80}
              className="h-full w-full object-contain"
              priority
            />
          </span>
          <h1 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.02em] text-black sm:text-[32px]">
            {NULLYSH_PAY_BRAND.name}
          </h1>
          <p className="mt-2 text-[13px] font-medium text-neutral-500">
            Gateway de pagamentos
          </p>
          <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-neutral-600">
            {firstName
              ? `${firstName}, venda cursos, infoprodutos e ofertas com o painel Nullysh Pay — vinculado à sua conta do fórum.`
              : "Venda cursos, infoprodutos e ofertas com o painel Nullysh Pay — vinculado à sua conta do fórum."}
          </p>
        </div>

        <div className="mt-8 space-y-3">
          {user ? (
            <Button
              type="button"
              size="lg"
              className="w-full"
              loading={loading}
              onClick={() => void continueWithForum()}
            >
              Entrar / criar conta no Nullysh Pay
            </Button>
          ) : (
            <Link
              href="/login?next=/app/nullysh-pay"
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-lg)] bg-[#1a1a1a] px-5 text-[15px] font-medium text-white shadow-[var(--shadow-sm)] transition-opacity hover:opacity-90"
            >
              Entrar para continuar
            </Link>
          )}

          <a
            href={payUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] border border-neutral-200 bg-white px-4 py-2.5 text-[14px] font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
          >
            Abrir painel Nullysh Pay
            <ArrowSquareOut size={16} weight="bold" />
          </a>
        </div>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-center text-[13px] font-medium text-red-700"
          >
            {error}
          </p>
        )}

        <p className="mt-6 text-center text-[12px] leading-relaxed text-neutral-400">
          Sua conta do fórum será vinculada ao merchant no Nullysh Pay. O
          processamento de pagamentos roda na plataforma externa.
        </p>
      </div>

      {loading && (
        <p className="mt-4 flex items-center justify-center gap-2 text-[13px] text-neutral-400">
          <SpinnerGap size={16} className="animate-spin" />
          Conectando…
        </p>
      )}
    </div>
  );
}
