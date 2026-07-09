"use client";

import { MarketingHeader } from "@/components/marketing-header";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useAuthStore } from "@/lib/auth-store";
import { VIP_PLAN } from "@/lib/mock-data";
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

  function handleSubscribe() {
    if (!user) {
      router.push("/register");
      return;
    }
    activateVip();
    setDone(true);
    setTimeout(() => router.push("/app"), 900);
  }

  return (
    <div className="min-h-[100dvh] bg-white">
      <MarketingHeader />
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="text-center">
          <p className="text-sm font-medium text-neutral-500">Acesso pago</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-neutral-950 sm:text-4xl">
            Um plano. Tudo liberado.
          </h1>
          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-neutral-500 sm:text-base">
            Sem confusão de tiers. O Plano VIP abre vídeos, materiais, salas
            exclusivas, chat e a rede completa.
          </p>
        </div>

        <div className="mt-12 rounded-3xl border border-neutral-200 bg-white p-8 shadow-[0_24px_80px_-48px_rgba(0,0,0,0.3)] sm:p-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-neutral-950 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white">
                <CrownSimple size={12} weight="fill" />
                {VIP_PLAN.name}
              </div>
              <p className="mt-4 text-sm text-neutral-500">
                Assinatura mensal · cancelamento simples (mock no MVP)
              </p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-4xl font-semibold tracking-tight text-neutral-950">
                {formatCurrency(VIP_PLAN.price)}
              </p>
              <p className="text-sm text-neutral-400">por {VIP_PLAN.period}</p>
            </div>
          </div>

          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {VIP_PLAN.features.map((f) => (
              <li
                key={f}
                className="flex items-start gap-2.5 text-sm text-neutral-700"
              >
                <Check
                  size={18}
                  weight="bold"
                  className="mt-0.5 shrink-0 text-neutral-950"
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
                <p className="text-sm font-medium text-neutral-950">
                  {done ? "VIP ativado. Indo para o forum..." : "Você já é VIP."}
                </p>
                <Link href="/app">
                  <Button size="lg" className="w-full sm:w-auto">
                    Ir para o Forum
                  </Button>
                </Link>
              </div>
            ) : (
              <Button size="lg" className="w-full" onClick={handleSubscribe}>
                {user ? "Ativar Plano VIP (simulado)" : "Criar conta e assinar"}
              </Button>
            )}
          </div>

          <p className="mt-4 text-center text-xs text-neutral-400">
            Pagamento real (Stripe / Hotmart / etc.) entra na próxima fase.
            Aqui o VIP é ativado no protótipo local.
          </p>
        </div>
      </main>
    </div>
  );
}
