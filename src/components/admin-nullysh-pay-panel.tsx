"use client";

/**
 * Painel ADM — ponte para a plataforma Nullysh Pay (externa).
 * Config Asaas e merchants ficam no app Pay.
 */

import { Button } from "@/components/ui/button";
import { NULLYSH_PAY_BRAND, getNullyshPayUrl } from "@/lib/nullysh-pay/config";
import { ArrowSquareOut, CreditCard, Info } from "@phosphor-icons/react";

type Props = {
  onToast: (msg: string) => void;
};

export function AdminNullyshPayPanel({ onToast }: Props) {
  const payUrl = getNullyshPayUrl();

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
        <p className="flex items-center gap-2 text-sm font-semibold text-[#1f1f1f]">
          <CreditCard size={18} weight="fill" />
          {NULLYSH_PAY_BRAND.name}
        </p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-500">
          O gateway de pagamentos é uma plataforma separada (backend, banco e
          Asaas próprios). No fórum só existe o vínculo de conta e o atalho
          para o painel.
        </p>
      </div>

      <div className="rounded-2xl border border-sky-200 bg-sky-50 p-5">
        <p className="flex items-center gap-2 text-sm font-semibold text-sky-950">
          <Info size={18} weight="bold" />
          Onde configurar
        </p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[13px] leading-relaxed text-sky-900/85">
          <li>
            API Key Asaas, webhooks e sandbox:{" "}
            <strong className="font-medium">Nullysh Pay → Configurações</strong>
          </li>
          <li>
            Membros criam merchant em{" "}
            <code className="rounded bg-white/80 px-1 text-[12px]">
              /app/nullysh-pay
            </code>{" "}
            com a conta do fórum
          </li>
          <li>
            URL da plataforma:{" "}
            <code className="rounded bg-white/80 px-1 text-[12px] break-all">
              {payUrl}
            </code>
          </li>
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <a href={payUrl} target="_blank" rel="noopener noreferrer">
            <Button
              type="button"
              size="sm"
              onClick={() => onToast("Abrindo Nullysh Pay…")}
            >
              Abrir Nullysh Pay
              <ArrowSquareOut size={15} weight="bold" />
            </Button>
          </a>
          <a href={`${payUrl}/dashboard/settings`} target="_blank" rel="noopener noreferrer">
            <Button type="button" size="sm" variant="outline">
              Configurações do gateway
            </Button>
          </a>
        </div>
      </div>
    </div>
  );
}
