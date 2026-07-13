"use client";

/**
 * Nullysh Pay — painel informativo + status do motor Asaas.
 * Configuração de API key: secrets do Worker (não no formulário do browser).
 */

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { NULLYSH_PAY_BRAND } from "@/lib/nullysh-pay/config";
import { cn } from "@/lib/utils";
import {
  CheckCircle,
  CreditCard,
  Key,
  Lock,
  ShieldCheck,
  SpinnerGap,
  Vault,
  WarningCircle,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useState } from "react";

type PayStatus = {
  ok?: boolean;
  brand?: string;
  processor?: string;
  configured?: boolean;
  sandbox?: boolean;
  apiKeyPresent?: boolean;
  apiKeyHint?: string | null;
  message?: string;
};

export default function NullyshPayPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [status, setStatus] = useState<PayStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/nullysh-pay/status", {
          cache: "no-store",
        });
        const data = (await res.json()) as PayStatus;
        if (!cancelled) setStatus(data);
      } catch {
        if (!cancelled) {
          setStatus({
            ok: false,
            configured: false,
            message: "Não foi possível consultar o status do gateway.",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const configured = !!status?.configured;

  return (
    <div className="app-page mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-6">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500 shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
          <CreditCard size={14} weight="fill" className="text-[#1f1f1f]" />
          {NULLYSH_PAY_BRAND.name}
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Nullysh Pay
        </h1>
        <p className="mt-2 max-w-xl text-base leading-relaxed text-neutral-600 dark:text-zinc-400">
          Gateway de pagamentos do fórum. A marca é{" "}
          <strong className="font-medium text-neutral-800">Nullysh Pay</strong>;
          o processamento é feito pelo{" "}
          <strong className="font-medium text-neutral-800">
            {NULLYSH_PAY_BRAND.processor}
          </strong>
          .
        </p>
      </header>

      {/* Status card */}
      <div className="mb-4 rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04)] dark:border-zinc-800 dark:bg-[#141414]">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
              configured
                ? "bg-emerald-50 text-emerald-700"
                : "bg-amber-50 text-amber-700"
            )}
          >
            {loading ? (
              <SpinnerGap size={22} className="animate-spin" />
            ) : configured ? (
              <CheckCircle size={22} weight="fill" />
            ) : (
              <WarningCircle size={22} weight="fill" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[#1f1f1f] dark:text-zinc-100">
              {loading
                ? "Consultando motor Asaas…"
                : configured
                  ? "Motor Asaas configurado"
                  : "API Key ainda não configurada"}
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-neutral-500">
              {status?.message ||
                "Status do Nullysh Pay no ambiente de produção."}
            </p>
            {!loading && (
              <dl className="mt-3 grid gap-1.5 text-[12px] text-neutral-500 sm:grid-cols-2">
                <div>
                  <dt className="font-medium text-neutral-400">Processador</dt>
                  <dd className="text-[#1f1f1f] dark:text-zinc-200">
                    {NULLYSH_PAY_BRAND.processor}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-neutral-400">Ambiente</dt>
                  <dd className="text-[#1f1f1f] dark:text-zinc-200">
                    {status?.sandbox ? "Sandbox (testes)" : "Produção"}
                  </dd>
                </div>
                {isAdmin && status?.apiKeyHint && (
                  <div className="sm:col-span-2">
                    <dt className="font-medium text-neutral-400">
                      Chave (mascarada)
                    </dt>
                    <dd className="font-mono text-[#1f1f1f] dark:text-zinc-200">
                      {status.apiKeyHint}
                    </dd>
                  </div>
                )}
              </dl>
            )}
          </div>
        </div>
      </div>

      {/* Fluxo NullPass */}
      <div className="mb-4 rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04)] dark:border-zinc-800 dark:bg-[#141414]">
        <p className="flex items-center gap-2 text-sm font-semibold text-[#1f1f1f] dark:text-zinc-100">
          <Vault size={18} weight="fill" />
          Integração com NullPass
        </p>
        <ul className="mt-3 space-y-2 text-[13px] leading-relaxed text-neutral-600 dark:text-zinc-400">
          <li>
            · Produtos, combos e order bumps do Vault geram cobrança via{" "}
            <strong className="font-medium text-neutral-800 dark:text-zinc-200">
              Nullysh Pay
            </strong>
            .
          </li>
          <li>
            · Preço cheio e preço promocional saem do catálogo admin.
          </li>
          <li>
            · O membro VIP solicita o benefício; o checkout Asaas entra na
            próxima etapa de cobrança automática.
          </li>
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/app/nullpass">
            <Button size="sm" variant="outline">
              Abrir NullPass
            </Button>
          </Link>
          {isAdmin && (
            <Link href="/app/admin?tab=nullpass">
              <Button size="sm">Editar catálogo</Button>
            </Link>
          )}
        </div>
      </div>

      {/* Admin: como colocar a key */}
      {isAdmin ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900/40 dark:bg-amber-950/25">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-950 dark:text-amber-100">
            <Key size={18} weight="bold" />
            Configurar API Key do Asaas
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-amber-900/85 dark:text-amber-100/80">
            Por segurança a chave{" "}
            <strong className="font-semibold">não fica no formulário</strong>{" "}
            do browser. Quando for ativar cobranças reais, me avise e colocamos
            no Worker com:
          </p>
          <pre className="mt-3 overflow-x-auto rounded-xl bg-[#1f1f1f] p-3 text-[12px] leading-relaxed text-emerald-300">
{`# Produção (Cloudflare Worker)
npx wrangler secret put ASAAS_API_KEY
# cole a chave do Asaas e Enter

# Opcional: sandbox
npx wrangler secret put ASAAS_SANDBOX
# valor: true

# Local (.dev.vars — nunca commitar)
ASAAS_API_KEY=sua_chave_aqui
ASAAS_SANDBOX=true`}
          </pre>
          <p className="mt-3 flex items-start gap-2 text-[12px] leading-relaxed text-amber-900/75 dark:text-amber-100/70">
            <Lock size={14} className="mt-0.5 shrink-0" weight="bold" />
            Use chave de <strong className="font-semibold">sandbox</strong>{" "}
            para testes e chave de <strong className="font-semibold">produção</strong>{" "}
            só quando o fluxo de pagamento estiver validado.
          </p>
          <a
            href={NULLYSH_PAY_BRAND.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex text-[13px] font-semibold text-sky-700 hover:underline dark:text-sky-400"
          >
            Documentação Asaas API →
          </a>
        </div>
      ) : (
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 text-[13px] leading-relaxed text-neutral-500 shadow-[0_1px_2px_rgb(0_0_0/0.04)] dark:border-zinc-800 dark:bg-[#141414] dark:text-zinc-400">
          <p className="flex items-center gap-2 font-semibold text-[#1f1f1f] dark:text-zinc-100">
            <ShieldCheck size={16} weight="fill" />
            Pagamentos seguros
          </p>
          <p className="mt-2">
            O checkout dos benefícios VIP é processado de forma segura. Em
            caso de dúvida sobre uma cobrança, fale com o staff no bate-papo
            #ajuda.
          </p>
        </div>
      )}
    </div>
  );
}
