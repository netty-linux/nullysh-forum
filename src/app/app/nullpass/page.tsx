"use client";

/**
 * NullPass — Vault VIP (UX Netflix).
 * Free vê vitrine borrada + gate; VIP vê catálogo e pode solicitar benefício.
 */

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { VipBadge, VipGate } from "@/components/vip-gate";
import { useAuth } from "@/hooks/use-auth";
import {
  NULLPASS_BADGE_LABEL,
  NULLPASS_CATALOG,
  getNullpassProduct,
  nullpassByCategory,
  nullpassCategories,
  type NullpassProduct,
} from "@/lib/nullpass-catalog";
import { cn } from "@/lib/utils";
import {
  CaretRight,
  CrownSimple,
  Key,
  Lock,
  Sparkle,
  Vault,
  X,
} from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createPortal } from "react-dom";

function BadgePill({
  badge,
}: {
  badge: NonNullable<NullpassProduct["badge"]>;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        badge === "novo" &&
          "bg-sky-500/90 text-white",
        badge === "custo-membro" &&
          "bg-amber-400/95 text-[#1f1f1f]",
        badge === "limitado" &&
          "bg-white/90 text-[#1f1f1f]"
      )}
    >
      {NULLPASS_BADGE_LABEL[badge]}
    </span>
  );
}

function PosterCard({
  product,
  locked,
  onOpen,
  featured,
}: {
  product: NullpassProduct;
  locked: boolean;
  onOpen: () => void;
  featured?: boolean;
}) {
  const reduce = useReducedMotion();

  return (
    <motion.button
      type="button"
      onClick={onOpen}
      whileHover={reduce || locked ? undefined : { scale: 1.04 }}
      whileTap={reduce ? undefined : { scale: 0.98 }}
      className={cn(
        "group relative shrink-0 overflow-hidden rounded-xl text-left",
        "ring-1 ring-white/10 shadow-[var(--shadow-sm)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c0c0c]",
        featured
          ? "aspect-[16/10] w-[min(100%,320px)] sm:w-[340px]"
          : "aspect-[2/3] w-[132px] sm:w-[148px] md:w-[160px]"
      )}
      aria-label={`${product.title}${locked ? " — exclusivo VIP" : ""}`}
    >
      <div
        className="absolute inset-0 transition duration-300 group-hover:scale-[1.03]"
        style={{ background: product.posterGradient }}
        aria-hidden
      />
      {/* vignette + grain feel */}
      <div
        className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/10"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 30% 20%, white 0%, transparent 45%)",
        }}
        aria-hidden
      />

      {product.badge && (
        <div className="absolute left-2 top-2 z-10">
          <BadgePill badge={product.badge} />
        </div>
      )}

      {locked && (
        <div className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm">
          <Lock size={14} weight="bold" aria-hidden />
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 z-10 p-3">
        <span
          className={cn(
            "mb-2 flex items-center justify-center rounded-lg bg-white/10 font-display text-white/90 backdrop-blur-sm",
            featured ? "h-12 w-12 text-lg" : "h-9 w-9 text-[13px]"
          )}
          aria-hidden
        >
          {product.monogram}
        </span>
        <p
          className={cn(
            "font-semibold tracking-tight text-white text-wrap-balance",
            featured ? "text-[16px]" : "line-clamp-2 text-[13px]"
          )}
        >
          {product.title}
        </p>
        {featured && (
          <p className="mt-0.5 line-clamp-2 text-[12px] text-white/70">
            {product.tagline}
          </p>
        )}
      </div>

      {/* hover CTA */}
      <div
        className={cn(
          "absolute inset-0 z-20 flex items-center justify-center bg-black/35 opacity-0 transition",
          "group-hover:opacity-100 group-focus-visible:opacity-100"
        )}
      >
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[12px] font-semibold text-[#1f1f1f] shadow-[var(--shadow-md)]">
          {locked ? (
            <>
              <CrownSimple size={14} weight="fill" className="text-amber-600" />
              VIP
            </>
          ) : (
            <>
              Ver
              <CaretRight size={14} weight="bold" />
            </>
          )}
        </span>
      </div>
    </motion.button>
  );
}

function NetflixRow({
  title,
  products,
  locked,
  onOpen,
  featured,
}: {
  title: string;
  products: NullpassProduct[];
  locked: boolean;
  onOpen: (id: string) => void;
  featured?: boolean;
}) {
  if (!products.length) return null;

  return (
    <section className="space-y-3">
      <h2 className="px-1 text-[15px] font-semibold tracking-tight text-white sm:text-[16px]">
        {title}
      </h2>
      <div
        className={cn(
          "flex gap-3 overflow-x-auto pb-2 pt-1 thin-scroll",
          "snap-x snap-mandatory",
          "-mx-1 px-1"
        )}
      >
        {products.map((p) => (
          <div key={p.id} className="snap-start">
            <PosterCard
              product={p}
              locked={locked}
              featured={featured}
              onOpen={() => onOpen(p.id)}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function ProductModal({
  product,
  locked,
  isVip,
  onClose,
  onRequest,
}: {
  product: NullpassProduct;
  locked: boolean;
  isVip: boolean;
  onClose: () => void;
  onRequest: () => void;
}) {
  const reduce = useReducedMotion();

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-4">
      <motion.button
        type="button"
        aria-label="Fechar"
        className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reduce ? 0 : 0.2 }}
        onClick={onClose}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="nullpass-modal-title"
        initial={reduce ? false : { opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduce ? undefined : { opacity: 0, y: 16, scale: 0.98 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className={cn(
          "relative z-10 flex max-h-[min(92dvh,720px)] w-full max-w-lg flex-col overflow-hidden",
          "rounded-t-2xl bg-[#141414] text-white shadow-[var(--shadow-lg)] sm:rounded-2xl",
          "ring-1 ring-white/10"
        )}
      >
        <div
          className="relative h-40 shrink-0 sm:h-48"
          style={{ background: product.posterGradient }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-transparent to-black/20" />
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition hover:bg-black/75"
            aria-label="Fechar"
          >
            <X size={18} weight="bold" />
          </button>
          <div className="absolute bottom-3 left-4 flex items-end gap-3">
            <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/10 text-lg font-semibold backdrop-blur-sm">
              {product.monogram}
            </span>
            <div className="pb-0.5">
              {product.badge && (
                <div className="mb-1">
                  <BadgePill badge={product.badge} />
                </div>
              )}
              <h2
                id="nullpass-modal-title"
                className="font-display text-[20px] font-semibold tracking-tight text-wrap-balance sm:text-[22px]"
              >
                {product.title}
              </h2>
            </div>
          </div>
        </div>

        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          <p className="text-[14px] leading-relaxed text-zinc-300">
            {product.tagline}
          </p>
          <p className="mt-3 text-[13px] leading-relaxed text-zinc-400">
            {product.description}
          </p>

          <div className="mt-4 flex flex-wrap items-baseline gap-2">
            <span className="text-[15px] font-semibold text-white">
              {product.priceLabel}
            </span>
            {product.priceHint && (
              <span className="text-[12px] text-zinc-500">
                {product.priceHint}
              </span>
            )}
            <VipBadge />
          </div>

          <ul className="mt-4 space-y-2">
            {product.features.map((f) => (
              <li
                key={f}
                className="flex gap-2 text-[13px] leading-snug text-zinc-300"
              >
                <Sparkle
                  size={14}
                  weight="fill"
                  className="mt-0.5 shrink-0 text-amber-400/90"
                  aria-hidden
                />
                {f}
              </li>
            ))}
          </ul>

          {isVip && !locked && (
            <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.04] p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                Como liberar
              </p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-300">
                {product.vipFulfillmentNote}
              </p>
            </div>
          )}

          {locked && (
            <div className="mt-5 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3">
              <p className="flex items-center gap-1.5 text-[13px] font-semibold text-amber-200">
                <Lock size={14} weight="bold" />
                Exclusivo do Vault VIP
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-amber-100/75">
                O NullPass é o cofre de benefícios do clube. Assine o VIP para
                solicitar acessos gerenciados com preço de custo para membros.
              </p>
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-2 border-t border-white/10 p-4 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="border-white/15 bg-transparent text-white hover:bg-white/10"
          >
            Fechar
          </Button>
          {locked ? (
            <Link href="/pricing" className="sm:min-w-[10rem]">
              <Button type="button" className="w-full">
                <CrownSimple size={15} weight="fill" />
                Assinar VIP
              </Button>
            </Link>
          ) : (
            <Button type="button" onClick={onRequest} className="sm:min-w-[10rem]">
              <Key size={15} weight="bold" />
              Solicitar benefício
            </Button>
          )}
        </div>
      </motion.div>
    </div>,
    document.body
  );
}

function NullpassPageInner() {
  const { user, isVip } = useAuth();
  const vip =
    !!isVip || user?.role === "admin" || user?.role === "vip";
  const locked = !vip;
  const searchParams = useSearchParams();
  const focusId = searchParams.get("id");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  const categories = useMemo(() => nullpassCategories(), []);
  const featured = useMemo(
    () =>
      NULLPASS_CATALOG.filter(
        (p) => p.badge === "novo" || p.badge === "custo-membro"
      ).slice(0, 6),
    []
  );

  const active = activeId ? getNullpassProduct(activeId) : null;

  useEffect(() => {
    if (!focusId) return;
    if (getNullpassProduct(focusId)) setActiveId(focusId);
  }, [focusId]);

  const openProduct = useCallback((id: string) => {
    setActiveId(id);
  }, []);

  async function handleRequest() {
    if (!active || locked) return;
    const text = `NullPass · solicito o benefício «${active.title}» (id: ${active.id})`;
    try {
      await navigator.clipboard.writeText(text);
      setToast("Pedido copiado. Cole no #ajuda ou no DM do staff.");
    } catch {
      setToast("Abra o #ajuda e peça o benefício pelo nome.");
    }
    window.setTimeout(() => {
      window.location.href = "/app/chat?channel=ajuda";
    }, 600);
    setActiveId(null);
  }

  const catalogPreview = (
    <div className="space-y-8">
      <NetflixRow
        title="Em destaque no Vault"
        products={featured}
        locked={locked}
        featured
        onOpen={openProduct}
      />
      {categories.map((cat) => (
        <NetflixRow
          key={cat}
          title={cat}
          products={nullpassByCategory(cat)}
          locked={locked}
          onOpen={openProduct}
        />
      ))}
    </div>
  );

  return (
    <div className="relative min-h-[100dvh] bg-[#0c0c0c] text-white">
      {/* ambient */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] opacity-90"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(245,158,11,0.18), transparent 55%), radial-gradient(ellipse 50% 40% at 90% 10%, rgba(16,185,129,0.12), transparent 50%)",
        }}
        aria-hidden
      />

      <div className="app-page relative mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        {/* Hero Vault */}
        <header className="mb-8 max-w-2xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
            <Vault size={14} weight="fill" className="text-amber-400" />
            NullPass · Vault
          </div>
          <h1 className="font-display text-[28px] font-semibold tracking-tight text-wrap-balance text-white sm:text-[32px]">
            Seu cofre de benefícios VIP
          </h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-zinc-400">
            Acessos e assinaturas de ferramentas selecionadas, com{" "}
            <strong className="font-medium text-zinc-200">
              preço de custo para membros
            </strong>
            . Liberação{" "}
            <strong className="font-medium text-zinc-200">
              gerenciada pelo staff
            </strong>{" "}
            — benefício do clube, não vitrine pública de contas.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <VipBadge />
            <span className="text-[12px] text-zinc-500">
              {NULLPASS_CATALOG.length} benefícios no catálogo
            </span>
          </div>
        </header>

        {toast && (
          <div
            role="status"
            className="mb-4 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-[13px] font-medium text-zinc-200"
          >
            {toast}
          </div>
        )}

        {NULLPASS_CATALOG.length === 0 ? (
          <EmptyState
            icon={<Vault size={28} weight="duotone" />}
            title="Vault vazio"
            description="Em breve novos benefícios entram no NullPass."
            className="border-white/10 bg-white/[0.03] text-zinc-300"
          />
        ) : locked ? (
          <VipGate
            title="NullPass é exclusivo VIP"
            description="O Vault reúne benefícios e acessos gerenciados do clube. Assine o Plano VIP para solicitar ferramentas com preço de custo para membros."
            blur
          >
            {catalogPreview}
          </VipGate>
        ) : (
          catalogPreview
        )}

        {/* Compliance note */}
        <p className="mt-10 max-w-2xl text-[11px] leading-relaxed text-zinc-600">
          NullPass oferece benefícios operados pelo Nullysh. O uso deve respeitar
          os termos de cada plataforma. O staff pode recusar, pausar ou enfileirar
          solicitações para manter o clube seguro e em conformidade.
        </p>
      </div>

      <AnimatePresence>
        {active && typeof document !== "undefined" && (
          <ProductModal
            key={active.id}
            product={active}
            locked={locked}
            isVip={vip}
            onClose={() => setActiveId(null)}
            onRequest={handleRequest}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default function NullpassPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center bg-[#0c0c0c] text-sm text-zinc-500">
          Abrindo NullPass…
        </div>
      }
    >
      <NullpassPageInner />
    </Suspense>
  );
}
