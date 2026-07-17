"use client";

/**
 * Modal de pagamento (VIP / NullPass): PIX ou Bitcoin com desconto.
 * QR in-app + polling + CPF obrigatório no PIX.
 */

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useAuthStore } from "@/lib/auth-store";
import { fetchProfileById } from "@/lib/supabase/auth-service";
import { formatCurrency } from "@/lib/utils";
import {
  CheckCircle,
  Copy,
  CurrencyBtc,
  SpinnerGap,
  X,
} from "@phosphor-icons/react";
import QRCode from "qrcode";
import { useCallback, useEffect, useMemo, useState } from "react";

type Billing = "PIX" | "BTC";

export type PlatformPaymentModalProps = {
  open: boolean;
  onClose: () => void;
  kind: "vip" | "nullpass";
  productKey: string;
  title: string;
  listPriceBrl: number;
  onPaid?: () => void;
};

type CheckoutResult = {
  publicUrl?: string;
  checkoutToken?: string;
  billingType?: string;
  btc?: {
    btcAddress: string;
    expectedSats: number;
    btcAmount?: number;
    amountBrlCentsCharged: number;
    discountPercent: number;
    qrUri?: string;
    status: string;
  };
  pix?: {
    qrCode?: string | null;
    copyPaste?: string | null;
    invoiceUrl?: string;
  };
};

function payBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_NULLYSH_PAY_URL?.replace(/\/+$/, "") ||
    "https://pay.nullysh.com"
  );
}

function onlyDigits(v: string) {
  return v.replace(/\D/g, "");
}

/** Máscara CPF (11) ou CNPJ (14) */
function formatDocMask(raw: string): string {
  const d = onlyDigits(raw).slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function isValidDoc(raw: string): boolean {
  const d = onlyDigits(raw);
  return d.length === 11 || d.length === 14;
}

function bitcoinUri(address: string, sats: number, qrUri?: string): string {
  if (qrUri?.startsWith("bitcoin:")) return qrUri;
  const btc = (sats / 1e8).toFixed(8);
  return `bitcoin:${address}?amount=${btc}`;
}

export function PlatformPaymentModal({
  open,
  onClose,
  kind,
  productKey,
  title,
  listPriceBrl,
  onPaid,
}: PlatformPaymentModalProps) {
  const [billing, setBilling] = useState<Billing>("PIX");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<CheckoutResult | null>(null);
  const [payStatus, setPayStatus] = useState("");
  const [document, setDocument] = useState("");
  const [btcQrDataUrl, setBtcQrDataUrl] = useState("");
  const [copied, setCopied] = useState(false);
  /** C1: só celebra VIP após perfil recarregar isVip */
  const [vipReady, setVipReady] = useState(false);
  const [fulfillWait, setFulfillWait] = useState(false);
  const [fulfillTimeout, setFulfillTimeout] = useState(false);

  const { user } = useAuth();
  const mergePublicUsers = useAuthStore((s) => s.mergePublicUsers);

  const listCents = Math.round(listPriceBrl * 100);
  const btcPreviewCents = Math.round(listCents * 0.85);

  useEffect(() => {
    if (!open) {
      setResult(null);
      setError("");
      setPayStatus("");
      setBilling("PIX");
      setBtcQrDataUrl("");
      setCopied(false);
      setDocument("");
      setVipReady(false);
      setFulfillWait(false);
      setFulfillTimeout(false);
    }
  }, [open]);

  // QR Bitcoin in-app
  useEffect(() => {
    if (!result?.btc?.btcAddress) {
      setBtcQrDataUrl("");
      return;
    }
    const uri = bitcoinUri(
      result.btc.btcAddress,
      result.btc.expectedSats,
      result.btc.qrUri
    );
    let cancelled = false;
    void QRCode.toDataURL(uri, {
      width: 220,
      margin: 2,
      color: { dark: "#1a1a1a", light: "#ffffff" },
    }).then((url) => {
      if (!cancelled) setBtcQrDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [result?.btc]);

  const pollStatus = useCallback(
    async (token: string, type: string) => {
      try {
        const base = payBaseUrl();
        const url =
          type === "BTC"
            ? `${base}/api/btc/status?token=${encodeURIComponent(token)}`
            : `${base}/api/checkout/status?token=${encodeURIComponent(token)}`;
        const res = await fetch(url, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) return;

        if (type === "BTC" && data.btc?.status) {
          setPayStatus(String(data.btc.status));
        } else if (data.status) {
          setPayStatus(String(data.status));
        }
      } catch {
        /* ignore */
      }
    },
    []
  );

  useEffect(() => {
    if (!result?.checkoutToken) return;
    if (payStatus === "paid") return;

    const type = result.billingType || billing;
    void pollStatus(result.checkoutToken, type);

    const id = window.setInterval(() => {
      void pollStatus(result.checkoutToken!, type);
    }, 12_000);
    return () => window.clearInterval(id);
  }, [result, payStatus, billing, pollStatus]);

  // C1: após paid, espera VIP no perfil (fulfillment Pay → Forum)
  useEffect(() => {
    if (payStatus !== "paid") return;
    if (kind !== "vip") {
      setVipReady(true);
      return;
    }
    if (user?.isVip) {
      setVipReady(true);
      setFulfillWait(false);
      return;
    }

    setFulfillWait(true);
    setFulfillTimeout(false);
    let cancelled = false;
    const started = Date.now();

    async function refreshVip() {
      if (!user?.id) return false;
      try {
        const profile = await fetchProfileById(user.id);
        if (profile) {
          mergePublicUsers([profile]);
          if (profile.isVip) return true;
        }
      } catch {
        /* ignore */
      }
      return false;
    }

    void refreshVip().then((ok) => {
      if (!cancelled && ok) {
        setVipReady(true);
        setFulfillWait(false);
      }
    });

    const id = window.setInterval(() => {
      void (async () => {
        if (cancelled) return;
        if (Date.now() - started > 90_000) {
          setFulfillTimeout(true);
          setFulfillWait(false);
          window.clearInterval(id);
          return;
        }
        const ok = await refreshVip();
        if (ok && !cancelled) {
          setVipReady(true);
          setFulfillWait(false);
          window.clearInterval(id);
        }
      })();
    }, 2_500);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [payStatus, kind, user?.id, user?.isVip, mergePublicUsers]);

  async function createCheckout() {
    setError("");
    if (billing === "PIX" && !isValidDoc(document)) {
      setError("Informe um CPF ou CNPJ válido.");
      return;
    }

    setLoading(true);
    setResult(null);
    setPayStatus("");
    setVipReady(false);
    setFulfillWait(false);
    setFulfillTimeout(false);
    try {
      const res = await fetch("/api/pay/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productKey,
          billingType: billing,
          document: onlyDigits(document) || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Não foi possível criar o pagamento.");
        return;
      }
      setResult(data as CheckoutResult);
      setPayStatus("pending");
      if (data.checkoutToken) {
        void pollStatus(data.checkoutToken, data.billingType || billing);
      }
    } catch {
      setError("Falha de rede. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  const invoicePaid = payStatus === "paid";
  /** Sucesso total: fatura paga + (VIP liberado no perfil | nullpass) */
  const paid = invoicePaid && (kind !== "vip" || vipReady);
  const successHeadline =
    kind === "vip"
      ? "Pagamento aprovado! Bem-vindo ao VIP"
      : "Pagamento aprovado! Benefício NullPass liberado";

  const chargedBrl = useMemo(() => {
    if (result?.btc?.amountBrlCentsCharged != null) {
      return result.btc.amountBrlCentsCharged / 100;
    }
    return listPriceBrl;
  }, [result, listPriceBrl]);

  const pixQrSrc = useMemo(() => {
    const q = result?.pix?.qrCode;
    if (!q) return "";
    return q.startsWith("data:") ? q : `data:image/png;base64,${q}`;
  }, [result?.pix?.qrCode]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pay-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Fechar"
        onClick={onClose}
      />
      <div className="relative z-[201] max-h-[min(92vh,720px)] w-full max-w-md overflow-y-auto rounded-t-2xl border border-neutral-200 bg-white p-5 shadow-lg sm:rounded-2xl">
        {paid ? (
          <div className="flex flex-col items-center py-8 text-center">
            <CheckCircle size={48} weight="fill" className="text-emerald-600" />
            <h2 className="mt-4 text-[20px] font-semibold tracking-tight text-[#1f1f1f]">
              {successHeadline}
            </h2>
            <p className="mt-2 text-[14px] text-neutral-500">
              {kind === "vip"
                ? "Seu acesso premium está liberado. Aproveite a comunidade."
                : "Tudo certo com o seu pagamento."}
            </p>
            <Button
              type="button"
              className="mt-6 w-full"
              onClick={() => {
                onPaid?.();
                onClose();
              }}
            >
              {kind === "vip" ? "Entrar no Forum" : "Continuar"}
            </Button>
          </div>
        ) : invoicePaid && kind === "vip" && fulfillWait ? (
          <div className="flex flex-col items-center py-8 text-center">
            <SpinnerGap
              size={40}
              className="animate-spin text-neutral-400"
            />
            <h2 className="mt-4 text-[18px] font-semibold tracking-tight text-[#1f1f1f]">
              Pagamento confirmado
            </h2>
            <p className="mt-2 text-[14px] text-neutral-500">
              Liberando seu acesso VIP… Um momento
            </p>
          </div>
        ) : invoicePaid && kind === "vip" && fulfillTimeout ? (
          <div className="flex flex-col items-center py-8 text-center">
            <CheckCircle size={48} weight="fill" className="text-amber-500" />
            <h2 className="mt-4 text-[18px] font-semibold tracking-tight text-[#1f1f1f]">
              Pagamento recebido
            </h2>
            <p className="mt-2 text-[14px] text-neutral-500">
              Seu pagamento foi confirmado. Se o VIP não aparecer em 1 minuto,
              atualize a página ou fale com o suporte.
            </p>
            <Button
              type="button"
              className="mt-6 w-full"
              onClick={() => {
                onPaid?.();
                onClose();
              }}
            >
              Ir para o Forum
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2
                  id="pay-modal-title"
                  className="text-[18px] font-semibold tracking-tight text-[#1f1f1f]"
                >
                  {result?.billingType === "BTC"
                    ? "Pague com Bitcoin"
                    : result?.billingType === "PIX"
                      ? "Pague com PIX"
                      : title}
                </h2>
                {!result && (
                  <p className="mt-1 text-[14px] text-neutral-600">
                    {formatCurrency(listPriceBrl)}
                    {billing === "BTC" && (
                      <span className="ml-2 text-[13px] text-amber-700">
                        · ~{formatCurrency(btcPreviewCents / 100)} no Bitcoin
                      </span>
                    )}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100"
                aria-label="Fechar"
              >
                <X size={18} weight="bold" />
              </button>
            </div>

            {!result ? (
              <div className="mt-5 space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setBilling("PIX")}
                    className={`rounded-xl border px-3 py-3 text-left text-[13px] font-medium transition-colors ${
                      billing === "PIX"
                        ? "border-[#1a1a1a] bg-[#1a1a1a] text-white"
                        : "border-neutral-200 bg-white text-neutral-700"
                    }`}
                  >
                    PIX
                    <span className="mt-0.5 block text-[11px] font-normal opacity-80">
                      Instantâneo
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBilling("BTC")}
                    className={`rounded-xl border px-3 py-3 text-left text-[13px] font-medium transition-colors ${
                      billing === "BTC"
                        ? "border-amber-600 bg-amber-600 text-white"
                        : "border-amber-200 bg-amber-50 text-amber-950"
                    }`}
                  >
                    <span className="inline-flex items-center gap-1">
                      <CurrencyBtc size={16} weight="fill" />
                      Bitcoin
                    </span>
                    <span className="mt-0.5 block text-[11px] font-normal opacity-90">
                      15% de desconto
                    </span>
                  </button>
                </div>

                {billing === "PIX" && (
                  <label className="block text-[12px] font-medium text-neutral-600">
                    CPF
                    <input
                      className="mt-1 h-10 w-full rounded-lg border border-neutral-200 px-3 text-[14px] font-normal text-[#1f1f1f]"
                      inputMode="numeric"
                      autoComplete="off"
                      required
                      value={document}
                      onChange={(e) =>
                        setDocument(formatDocMask(e.target.value))
                      }
                      placeholder="000.000.000-00"
                      aria-required="true"
                    />
                  </label>
                )}

                {error && (
                  <p className="text-[13px] text-red-600" role="alert">
                    {error}
                  </p>
                )}

                <Button
                  type="button"
                  className="w-full"
                  loading={loading}
                  onClick={() => void createCheckout()}
                >
                  {billing === "BTC" ? "Pagar com Bitcoin" : "Pagar com PIX"}
                </Button>
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                {/* BTC */}
                {result.billingType === "BTC" && result.btc && (
                  <>
                    <p className="text-[13px] leading-relaxed text-neutral-500">
                      Escaneie o QR Code abaixo com o seu aplicativo (Bipa, Muun,
                      etc.) para pagar com 15% de desconto.
                    </p>
                    <div className="flex flex-col items-center gap-2 rounded-2xl border border-neutral-100 bg-neutral-50/50 px-4 py-5">
                      {btcQrDataUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={btcQrDataUrl}
                          alt="QR Code Bitcoin"
                          className="h-[220px] w-[220px] rounded-xl bg-white p-2"
                        />
                      ) : (
                        <div className="flex h-[220px] w-[220px] items-center justify-center">
                          <SpinnerGap
                            size={28}
                            className="animate-spin text-neutral-400"
                          />
                        </div>
                      )}
                      <div className="mt-1 text-center">
                        <p className="text-[13px] text-neutral-400 line-through">
                          {formatCurrency(listPriceBrl)}
                        </p>
                        <p className="text-[20px] font-semibold tabular-nums tracking-tight text-[#1f1f1f]">
                          {formatCurrency(chargedBrl)}
                        </p>
                        <p className="mt-0.5 text-[13px] tabular-nums text-neutral-500">
                          {result.btc.expectedSats.toLocaleString("pt-BR")} sats
                        </p>
                      </div>
                    </div>
                    <div className="rounded-xl bg-neutral-50 px-3 py-2.5">
                      <p className="break-all font-mono text-[11px] leading-relaxed text-neutral-700">
                        {result.btc.btcAddress}
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="mt-2"
                        onClick={() => void copyText(result.btc!.btcAddress)}
                      >
                        <Copy size={14} />
                        {copied ? "Copiado" : "Copiar endereço"}
                      </Button>
                    </div>
                    <div className="flex items-center justify-center gap-2 text-[13px] text-neutral-500">
                      <SpinnerGap
                        size={16}
                        className="animate-spin text-neutral-400"
                      />
                      <span>Aguardando pagamento… Um momento</span>
                    </div>
                  </>
                )}

                {/* PIX — paridade com Bitcoin */}
                {result.billingType === "PIX" && (
                  <>
                    <p className="text-[13px] leading-relaxed text-neutral-500">
                      Escaneie o QR Code abaixo com o app do seu banco.
                    </p>
                    <div className="flex flex-col items-center gap-2 rounded-2xl border border-neutral-100 bg-neutral-50/50 px-4 py-5">
                      {pixQrSrc ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={pixQrSrc}
                          alt="QR Code PIX"
                          className="h-[220px] w-[220px] rounded-xl bg-white p-2 object-contain"
                        />
                      ) : (
                        <div className="flex h-[220px] w-[220px] flex-col items-center justify-center gap-2 text-center text-[12px] text-neutral-400">
                          <SpinnerGap
                            size={28}
                            className="animate-spin"
                          />
                          Gerando QR Code…
                        </div>
                      )}
                      <p className="mt-1 text-[20px] font-semibold tabular-nums tracking-tight text-[#1f1f1f]">
                        {formatCurrency(listPriceBrl)}
                      </p>
                    </div>
                    {result.pix?.copyPaste && (
                      <div className="rounded-xl bg-neutral-50 px-3 py-2.5">
                        <p className="break-all font-mono text-[11px] leading-relaxed text-neutral-700 line-clamp-3">
                          {result.pix.copyPaste}
                        </p>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="mt-2"
                          onClick={() =>
                            void copyText(result.pix!.copyPaste || "")
                          }
                        >
                          <Copy size={14} />
                          {copied ? "Copiado" : "Copiar código PIX"}
                        </Button>
                      </div>
                    )}
                    <div className="flex items-center justify-center gap-2 text-[13px] text-neutral-500">
                      <SpinnerGap
                        size={16}
                        className="animate-spin text-neutral-400"
                      />
                      <span>Aguardando pagamento… Um momento</span>
                    </div>
                  </>
                )}

                {error && (
                  <p className="text-[13px] text-red-600" role="alert">
                    {error}
                  </p>
                )}

                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    setResult(null);
                    setPayStatus("");
                    setBtcQrDataUrl("");
                    setVipReady(false);
                    setFulfillWait(false);
                    setFulfillTimeout(false);
                  }}
                >
                  Voltar
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
