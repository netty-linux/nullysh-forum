"use client";

import { MarketingHeader } from "@/components/marketing-header";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useAuthStore } from "@/lib/auth-store";
import { VIP_PLAN } from "@/lib/mock-data";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { formatCurrency } from "@/lib/utils";
import { Check, CrownSimple } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function PricingPage() {
  const { user, isVip, hydrated } = useAuth();
  const activateVip = useAuthStore((s) => s.activateVip);
  const router = useRouter();
  const [done, setDone] = useState(false);

  const [vipError, setVipError] = useState("");

  async function handleSubscribe() {
    if (!user) {
      router.push("/register");
      return;
    }
    setVipError("");
    // Offline/demo: activateVip local. Com Supabase: bloqueado no servidor (AppSec).
    await activateVip();
    const stillFree = !useAuthStore.getState().getCurrentUser()?.isVip;
    if (stillFree && isSupabaseConfigured()) {
      setVipError(
        "VIP real exige pagamento (webhook no servidor). Self-promote no cliente foi desativado por segurança."
      );
      return;
    }
    setDone(true);
    setTimeout(() => router.push("/app"), 900);
  }

  return (
    <div className="min-h-[100dvh] bg-[#f0f0f0]">
      <MarketingHeader />
      <main className="app-page mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">
            Acesso pago
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-black sm:text-5xl">
            Um plano. Tudo liberado.
          </h1>
          <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-neutral-600">
            Sem confusão de tiers. O Plano VIP abre vídeos, materiais, salas
            exclusivas, chat e a rede completa.
          </p>
        </div>

        <div className="mt-12 overflow-hidden rounded-2xl border-2 border-black bg-white shadow-[8px_8px_0_0_#1f1f1f]">
          <div className="flex flex-col gap-6 border-b-2 border-black bg-black p-8 text-white sm:flex-row sm:items-start sm:justify-between sm:p-10">
            <div>
              <div className="inline-flex items-center gap-2 rounded-md bg-white px-2.5 py-1 text-[11px] font-bold tracking-wide text-black">
                <CrownSimple size={12} weight="fill" />
                {VIP_PLAN.name}
              </div>
              <p className="mt-4 text-sm text-neutral-400">
                Assinatura mensal · cancelamento simples (mock no MVP)
              </p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl">
                {formatCurrency(VIP_PLAN.price)}
              </p>
              <p className="text-sm text-neutral-400">por {VIP_PLAN.period}</p>
            </div>
          </div>

          <div className="p-8 sm:p-10">
            <ul className="grid gap-3 sm:grid-cols-2">
              {VIP_PLAN.features.map((f) => (
                <li
                  key={f}
                  className="flex items-start gap-2.5 text-sm font-medium text-neutral-700"
                >
                  <Check
                    size={18}
                    weight="bold"
                    className="mt-0.5 shrink-0 text-black"
                  />
                  {f}
                </li>
              ))}
            </ul>

            <div className="mt-10">
              {!hydrated ? (
                <div className="h-12 animate-pulse rounded-xl bg-neutral-100" />
              ) : isVip || done ? (
                <div className="space-y-3 text-center">
                  <p className="text-sm font-semibold text-black">
                    {done
                      ? "VIP ativado. Indo para o forum..."
                      : "Você já é VIP."}
                  </p>
                  <Link href="/app">
                    <Button size="lg" className="w-full sm:w-auto">
                      Ir para o Forum
                    </Button>
                  </Link>
                </div>
              ) : (
                <Button size="lg" className="w-full" onClick={handleSubscribe}>
                  {user
                    ? "Ativar Plano VIP (simulado)"
                    : "Criar conta e assinar"}
                </Button>
              )}
            </div>

            {vipError && (
              <p className="mt-3 text-center text-[13px] font-medium text-red-600">
                {vipError}
              </p>
            )}
            <p className="mt-4 text-center text-xs text-neutral-500">
              Pagamento real (Stripe / Hotmart / etc.) ativa VIP no servidor.
              Self-promote no browser foi desativado (segurança).
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
