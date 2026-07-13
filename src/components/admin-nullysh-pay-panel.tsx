"use client";

/**
 * Configuração global Nullysh Pay (Asaas) — somente Painel ADM.
 * API keys nunca no formulário do browser; só secrets do Worker.
 */

import { Button } from "@/components/ui/button";
import { NULLYSH_PAY_BRAND } from "@/lib/nullysh-pay/config";
import { cn } from "@/lib/utils";
import {
  CheckCircle,
  CreditCard,
  Key,
  Lock,
  SpinnerGap,
  WarningCircle,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";

type Props = {
  onToast: (msg: string) => void;
};

type PayStatus = {
  configured?: boolean;
  sandbox?: boolean;
  apiKeyPresent?: boolean;
  apiKeyHint?: string | null;
  message?: string;
};

export function AdminNullyshPayPanel({ onToast }: Props) {
  const [status, setStatus] = useState<PayStatus | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/nullysh-pay/status", { cache: "no-store" });
      const data = (await res.json()) as PayStatus;
      setStatus(data);
    } catch {
      setStatus({
        configured: false,
        message: "Falha ao consultar status do gateway.",
      });
      onToast("Não foi possível ler o status do Asaas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const configured = !!status?.configured;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
        <p className="flex items-center gap-2 text-sm font-semibold text-[#1f1f1f]">
          <CreditCard size={18} weight="fill" />
          {NULLYSH_PAY_BRAND.name} · configuração do processador
        </p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-500">
          Marca de pagamento do fórum. O motor é o{" "}
          <strong className="font-medium text-neutral-700">
            {NULLYSH_PAY_BRAND.processor}
          </strong>
          . Membros usam o dashboard em{" "}
          <code className="rounded bg-neutral-100 px-1 text-[12px]">
            /app/nullysh-pay
          </code>{" "}
          para vender; as chaves ficam só aqui (servidor).
        </p>
      </div>

      <div className="rounded-2xl border border-neutral-200/90 bg-white p-5">
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
            <p className="text-sm font-semibold text-[#1f1f1f]">
              {loading
                ? "Consultando Asaas…"
                : configured
                  ? "Asaas configurado no Worker"
                  : "Aguardando API Key no servidor"}
            </p>
            <p className="mt-1 text-[13px] text-neutral-500">
              {status?.message || "—"}
            </p>
            {!loading && (
              <dl className="mt-3 grid gap-2 text-[12px] sm:grid-cols-2">
                <div>
                  <dt className="text-neutral-400">Ambiente</dt>
                  <dd className="font-medium text-[#1f1f1f]">
                    {status?.sandbox ? "Sandbox (testes)" : "Produção"}
                  </dd>
                </div>
                <div>
                  <dt className="text-neutral-400">Chave (mascarada)</dt>
                  <dd className="font-mono font-medium text-[#1f1f1f]">
                    {status?.apiKeyHint || "—"}
                  </dd>
                </div>
              </dl>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-3"
              loading={loading}
              onClick={() => void load()}
            >
              Atualizar status
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <p className="flex items-center gap-2 text-sm font-semibold text-amber-950">
          <Key size={18} weight="bold" />
          Como colocar a API Key (Asaas)
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-amber-900/85">
          A chave <strong className="font-semibold">não entra em input</strong>{" "}
          nesta tela (segurança). Quando for ligar cobranças reais, use secrets
          do Cloudflare Worker:
        </p>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-[#1f1f1f] p-3 text-[12px] leading-relaxed text-emerald-300">
{`npx wrangler secret put ASAAS_API_KEY
# cole a chave e Enter

# opcional sandbox
npx wrangler secret put ASAAS_SANDBOX
# true

# local (.dev.vars — não commitar)
ASAAS_API_KEY=...
ASAAS_SANDBOX=true`}
        </pre>
        <p className="mt-3 flex items-start gap-2 text-[12px] leading-relaxed text-amber-900/75">
          <Lock size={14} className="mt-0.5 shrink-0" weight="bold" />
          Use sandbox para testes. Produção só após validar webhooks e
          checkout. Me avise quando for a hora de gravar a key no ambiente.
        </p>
        <a
          href={NULLYSH_PAY_BRAND.docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex text-[13px] font-semibold text-sky-700 hover:underline"
        >
          Docs Asaas API →
        </a>
      </div>
    </div>
  );
}
