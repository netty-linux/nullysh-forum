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
import {
  ArrowSquareOut,
  CheckCircle,
  CreditCard,
  Lightning,
  LockKey,
  ShieldCheck,
  SpinnerGap,
} from "@phosphor-icons/react";
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
        Carregando Nullysh Pay…
      </div>
    );
  }

  return (
    <div className="app-page mx-auto flex max-w-xl flex-col px-4 py-8 sm:px-6 sm:py-12">
      {/* Header section */}
      <div className="mb-6 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-50/80 px-3 py-1 text-[12px] font-semibold text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300 mb-3">
          <CreditCard size={15} weight="fill" />
          Gateway de Pagamentos Nativo
        </div>
        <h1 className="font-display text-[1.75rem] font-semibold tracking-tight text-[#1f1f1f] dark:text-zinc-50 sm:text-[2.25rem]">
          {NULLYSH_PAY_BRAND.name}
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-neutral-500 dark:text-zinc-400">
          Venda cursos, ofertas, infoprodutos e assinaturas diretamente integrados à sua conta do Fórum.
        </p>
      </div>

      {/* Main Fintech Portal Card */}
      <div className="overflow-hidden rounded-3xl border border-neutral-200/90 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-[#141414] sm:p-8">
        {/* Brand Icon Header */}
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-neutral-50 p-2 ring-1 ring-neutral-200/80 shadow-sm dark:bg-zinc-900 dark:ring-zinc-800">
            <Image
              src="/brand/nullysh-pay-logo.png"
              alt={NULLYSH_PAY_BRAND.name}
              width={72}
              height={72}
              className="h-full w-full object-contain"
              priority
            />
          </div>

          {/* Connected User Identity Badge */}
          {user && (
            <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200/80 bg-neutral-50 px-3.5 py-1.5 text-xs text-neutral-700 dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-300 mb-2">
              <CheckCircle size={15} weight="fill" className="text-emerald-500 shrink-0" />
              <span>Conectado como <strong className="font-semibold text-neutral-900 dark:text-white">@{user.username}</strong></span>
            </div>
          )}
        </div>

        {/* Feature Benefits List */}
        <div className="my-6 space-y-3.5 rounded-2xl border border-neutral-100 bg-neutral-50/60 p-4 dark:border-zinc-800/80 dark:bg-zinc-900/40 text-xs sm:text-sm">
          <div className="flex items-start gap-3">
            <CreditCard size={18} weight="fill" className="text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold text-[#1f1f1f] dark:text-zinc-100 block">Checkout de Alta Conversão</strong>
              <span className="text-neutral-500 dark:text-zinc-400">Aceite PIX com aprovação instantânea, cartão de crédito e assinaturas recorrentes.</span>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Lightning size={18} weight="fill" className="text-amber-500 shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold text-[#1f1f1f] dark:text-zinc-100 block">Entrega & Liberação Automática</strong>
              <span className="text-neutral-500 dark:text-zinc-400">Liberação imediata de acessos VIP, cursos e materiais exclusivos do Fórum após a aprovação.</span>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <ShieldCheck size={18} weight="fill" className="text-sky-500 shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold text-[#1f1f1f] dark:text-zinc-100 block">SSO Integrado em 1 Clique</strong>
              <span className="text-neutral-500 dark:text-zinc-400">Seu painel de vendas sincronizado nativamente com sua identidade de membro Nullysh.</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3 pt-2">
          {user ? (
            <Button
              type="button"
              size="lg"
              className="h-12 w-full rounded-2xl text-sm font-semibold shadow-md transition-all hover:scale-[1.01]"
              loading={loading}
              onClick={() => void continueWithForum()}
            >
              Entrar / Criar Conta no Nullysh Pay
            </Button>
          ) : (
            <Link
              href="/login?next=/app/nullysh-pay"
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#1f1f1f] px-5 text-sm font-semibold text-white shadow-md transition-all hover:opacity-90 dark:bg-zinc-100 dark:text-[#141414]"
            >
              Entrar no Fórum para Continuar
            </Link>
          )}

          <a
            href={payUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 text-xs font-semibold text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Abrir Painel Nullysh Pay
            <ArrowSquareOut size={15} weight="bold" />
          </a>
        </div>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-rose-50 px-3 py-2.5 text-center text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
          >
            {error}
          </p>
        )}

        {/* Security Footnote */}
        <div className="mt-6 flex items-center justify-center gap-1.5 text-center text-[12px] text-neutral-400 dark:text-zinc-500">
          <LockKey size={14} className="shrink-0" />
          <span>Sua conta do Fórum é vinculada ao gateway com criptografia.</span>
        </div>
      </div>

      {loading && (
        <p className="mt-4 flex items-center justify-center gap-2 text-xs font-medium text-neutral-500 dark:text-zinc-400">
          <SpinnerGap size={16} className="animate-spin text-emerald-500" />
          Conectando de forma segura ao Nullysh Pay…
        </p>
      )}
    </div>
  );
}

