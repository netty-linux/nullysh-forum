"use client";

/**
 * NullPass — Vault VIP (UX Netflix em cards).
 * Visual alinhado ao resto do fórum: fundo claro, bordas arredondadas, surfaces brancas.
 * Free vê vitrine borrada + gate; VIP vê catálogo e solicita benefício.
 */

import { EmptyState } from "@/components/empty-state";
import { PlatformPaymentModal } from "@/components/platform-payment-modal";
import { Button } from "@/components/ui/button";
import { VipBadge, VipGate } from "@/components/vip-gate";
import { useAuth } from "@/hooks/use-auth";
import {
  NULLPASS_BADGE_LABEL,
  compareNullpassProducts,
  formatNullpassCompareAt,
  formatNullpassPrice,
  nullpassByCategory,
  nullpassCategories,
  nullpassFeatured,
  effectiveNullpassPrice,
  type NullpassProduct,
} from "@/lib/nullpass-catalog";
import { useNullpassStore } from "@/lib/nullpass-store";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  CaretRight,
  CrownSimple,
  Key,
  Lock,
  Package,
  ShieldCheck,
  Sparkle,
  Stack,
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
  badge: Exclude<NullpassProduct["badge"], null | undefined>;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider shadow-xs",
        badge === "novo" && "bg-sky-500 text-white",
        badge === "custo-membro" && "bg-amber-400 text-neutral-950 font-bold",
        badge === "limitado" && "bg-white text-neutral-900 ring-1 ring-black/10"
      )}
    >
      {NULLPASS_BADGE_LABEL[badge]}
    </span>
  );
}

/** Capa com fallback nativo (gradiente + monograma) se URL falhar / CORS. */
function PosterMedia({
  product,
  featured,
  showCover,
  onImgError,
  className,
}: {
  product: NullpassProduct;
  featured?: boolean;
  showCover: boolean;
  onImgError: () => void;
  className?: string;
}) {
  return (
    <div className={cn("absolute inset-0 overflow-hidden", className)}>
      {showCover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={product.coverUrl!}
          alt=""
          draggable={false}
          loading="lazy"
          decoding="async"
          onError={onImgError}
          className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <div
          className="absolute inset-0 flex items-center justify-center transition-transform duration-300 group-hover:scale-105"
          style={{ background: product.posterGradient }}
          aria-hidden
        >
          <span
            className={cn(
              "font-display font-semibold text-white/90",
              featured ? "text-3xl" : "text-xl"
            )}
          >
            {product.monogram}
          </span>
        </div>
      )}
      <div
        className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/5"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.14]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 30% 20%, white 0%, transparent 45%)",
        }}
        aria-hidden
      />
    </div>
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

  // Reseta ao trocar de produto/capa — durante a renderização, sem efeito.
  const imgResetKey = `${product.id}:${product.coverUrl ?? ""}`;
  const [prevImgResetKey, setPrevImgResetKey] = useState(imgResetKey);
  const [imgFailedRaw, setImgFailed] = useState(false);
  const imgFailed =
    prevImgResetKey === imgResetKey ? imgFailedRaw : false;
  if (prevImgResetKey !== imgResetKey) {
    setPrevImgResetKey(imgResetKey);
  }

  const showCover = Boolean(product.coverUrl) && !imgFailed;

  return (
    <motion.button
      type="button"
      onClick={onOpen}
      whileHover={reduce || locked ? undefined : { y: -4, scale: 1.02 }}
      whileTap={reduce ? undefined : { scale: 0.98 }}
      className={cn(
        "group relative shrink-0 overflow-hidden text-left transition-all duration-200",
        "rounded-2xl border border-neutral-200/90 bg-white shadow-sm hover:shadow-md dark:border-zinc-800 dark:bg-[#141414]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2",
        featured
          ? "aspect-[16/10] w-[min(100%,320px)] sm:w-[340px]"
          : "aspect-[2/3] w-[136px] sm:w-[152px] md:w-[165px]"
      )}
      aria-label={`${product.title}${locked ? " — exclusivo VIP" : ""}`}
    >
      <PosterMedia
        product={product}
        featured={featured}
        showCover={showCover}
        onImgError={() => setImgFailed(true)}
      />

      <div className="absolute left-2.5 top-2.5 z-10 flex flex-wrap gap-1">
        {product.isPinned && (
          <span className="inline-flex items-center rounded-md bg-[#1f1f1f] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-xs">
            Fixado
          </span>
        )}
        {product.badge && <BadgePill badge={product.badge} />}
        {product.kind === "combo" && (
          <span className="inline-flex items-center rounded-md bg-violet-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-xs">
            Combo
          </span>
        )}
        {product.promoActive && (
          <span className="inline-flex items-center rounded-md bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-xs">
            Promo
          </span>
        )}
      </div>

      {locked && (
        <div className="absolute right-2.5 top-2.5 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white backdrop-blur-md shadow-xs">
          <Lock size={13} weight="bold" aria-hidden />
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 z-10 p-3">
        {showCover && (
          <span
            className={cn(
              "mb-2 flex items-center justify-center rounded-xl bg-white/20 font-display text-white backdrop-blur-md ring-1 ring-white/25 shadow-xs",
              featured ? "h-11 w-11 text-base" : "h-8 w-8 text-[12px]"
            )}
            aria-hidden
          >
            {product.monogram}
          </span>
        )}
        <p
          className={cn(
            "font-display font-semibold tracking-tight text-white",
            featured ? "text-[16px]" : "line-clamp-2 text-[13px]"
          )}
        >
          {product.title}
        </p>
        {featured && (
          <p className="mt-0.5 line-clamp-2 text-[12px] text-white/80">
            {product.tagline}
          </p>
        )}
        <p className="mt-1 flex flex-wrap items-baseline gap-1.5 text-[12px] font-bold text-white">
          {formatNullpassCompareAt(product) && (
            <span className="text-[11px] font-medium text-white/60 line-through">
              {formatNullpassCompareAt(product)}
            </span>
          )}
          <span>{formatNullpassPrice(product)}</span>
        </p>
      </div>

      <div
        className={cn(
          "absolute inset-0 z-20 flex items-center justify-center bg-black/35 opacity-0 transition-opacity duration-200",
          "group-hover:opacity-100 group-focus-visible:opacity-100"
        )}
      >
        <span className="inline-flex items-center gap-1 rounded-full bg-white px-3.5 py-1.5 text-[12px] font-bold text-neutral-950 shadow-md">
          {locked ? (
            <>
              <CrownSimple size={14} weight="fill" className="text-amber-500" />
              Ver VIP
            </>
          ) : (
            <>
              Detalhes
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
      <div className="flex items-center gap-2 px-0.5">
        {featured ? (
          <Sparkle size={16} weight="fill" className="text-amber-500 shrink-0" />
        ) : (
          <Vault size={16} weight="bold" className="text-neutral-400 shrink-0" />
        )}
        <h2 className="font-display text-sm font-semibold tracking-tight text-[#1f1f1f] dark:text-zinc-50 sm:text-base">
          {title}
        </h2>
      </div>

      <div
        className={cn(
          "flex gap-3.5 overflow-x-auto overflow-y-hidden py-2 thin-scroll",
          "snap-x snap-mandatory",
          "-mx-1 px-1"
        )}
      >
        {products.map((p) => (
          <div key={p.id} className="snap-start shrink-0">
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

function PosterSkeleton({ featured }: { featured?: boolean }) {
  return (
    <div
      className={cn(
        "shrink-0 animate-pulse rounded-2xl border border-neutral-200/80 bg-neutral-100 dark:border-zinc-800 dark:bg-zinc-900",
        featured
          ? "aspect-[16/10] w-[min(100%,320px)] sm:w-[340px]"
          : "aspect-[2/3] w-[136px] sm:w-[152px] md:w-[165px]"
      )}
      aria-hidden
    />
  );
}

function NullpassCatalogSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Carregando catálogo">
      <section className="space-y-3">
        <div className="h-4 w-40 animate-pulse rounded bg-neutral-200 dark:bg-zinc-800" />
        <div className="flex gap-3 overflow-hidden py-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <PosterSkeleton key={`f-${i}`} featured />
          ))}
        </div>
      </section>
      {Array.from({ length: 2 }).map((_, row) => (
        <section key={row} className="space-y-3">
          <div className="h-4 w-32 animate-pulse rounded bg-neutral-200 dark:bg-zinc-800" />
          <div className="flex gap-3 overflow-hidden py-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <PosterSkeleton key={`${row}-${i}`} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function ProductModal({
  product,
  locked,
  isVip,
  onClose,
  onRequest,
  catalog,
}: {
  product: NullpassProduct;
  locked: boolean;
  isVip: boolean;
  onClose: () => void;
  onRequest: () => void;
  catalog: NullpassProduct[];
}) {
  const reduce = useReducedMotion();

  // Reseta ao trocar de produto/capa — durante a renderização, sem efeito.
  const imgResetKey = `${product.id}:${product.coverUrl ?? ""}`;
  const [prevImgResetKey, setPrevImgResetKey] = useState(imgResetKey);
  const [imgFailedRaw, setImgFailed] = useState(false);
  const imgFailed =
    prevImgResetKey === imgResetKey ? imgFailedRaw : false;
  if (prevImgResetKey !== imgResetKey) {
    setPrevImgResetKey(imgResetKey);
  }

  const byId = (id: string) => catalog.find((p) => p.id === id);
  const bundleItems = (product.bundleIds || [])
    .map(byId)
    .filter(Boolean) as NullpassProduct[];
  const bumpItems = (product.orderBumpIds || [])
    .map(byId)
    .filter(Boolean) as NullpassProduct[];
  const compareAt = formatNullpassCompareAt(product);
  const showCover = Boolean(product.coverUrl) && !imgFailed;

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
        className="absolute inset-0 bg-black/50 backdrop-blur-xs"
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
          "rounded-t-3xl bg-white text-[#1f1f1f] shadow-2xl sm:rounded-3xl",
          "border border-neutral-200/90 dark:border-zinc-800 dark:bg-[#141414] dark:text-zinc-100"
        )}
      >
        <div
          className="relative h-44 shrink-0 overflow-hidden sm:h-52"
          style={{
            background: showCover ? undefined : product.posterGradient,
          }}
        >
          {showCover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.coverUrl!}
              alt=""
              draggable={false}
              onError={() => setImgFailed(true)}
              className="absolute inset-0 h-full w-full object-cover object-center"
            />
          ) : (
            <div
              className="absolute inset-0 flex items-center justify-center"
              aria-hidden
            >
              <span className="font-display text-4xl font-semibold text-white/90">
                {product.monogram}
              </span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-black/20 dark:from-[#141414]" />
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3.5 top-3.5 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white backdrop-blur-md transition hover:bg-black/80"
            aria-label="Fechar"
          >
            <X size={18} weight="bold" />
          </button>
          <div className="absolute bottom-3.5 left-4 flex items-end gap-3">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 font-display text-xl font-bold text-white backdrop-blur-md ring-1 ring-white/30 shadow-md">
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
                className="font-display text-xl sm:text-2xl font-bold tracking-tight text-white"
                style={{ textShadow: "0 2px 10px rgba(0,0,0,0.5)" }}
              >
                {product.title}
              </h2>
            </div>
          </div>
        </div>

        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-5 py-5 space-y-4">
          <p className="text-sm leading-relaxed font-semibold text-[#1f1f1f] dark:text-zinc-100">
            {product.tagline}
          </p>
          <p className="text-xs sm:text-sm leading-relaxed text-neutral-600 dark:text-zinc-400">
            {product.description}
          </p>

          <div className="flex flex-wrap items-baseline gap-2 pt-1 border-t border-neutral-100 dark:border-zinc-800">
            {compareAt && (
              <span className="text-xs font-medium text-neutral-400 line-through">
                {compareAt}
              </span>
            )}
            <span className="text-base font-bold text-[#1f1f1f] dark:text-zinc-50 font-mono">
              {formatNullpassPrice(product)}
            </span>
            {product.promoActive && (
              <span className="rounded-md bg-rose-100 px-2 py-0.5 text-[10px] font-bold uppercase text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                Promo
              </span>
            )}
            {product.priceHint && (
              <span className="text-xs text-neutral-400">
                {product.priceHint}
              </span>
            )}
            <VipBadge />
          </div>

          {product.kind === "combo" && bundleItems.length > 0 && (
            <div className="rounded-2xl border border-violet-200 bg-violet-50/80 p-3.5 dark:border-violet-900/40 dark:bg-violet-950/20">
              <p className="flex items-center gap-1.5 text-xs font-bold text-violet-900 dark:text-violet-200">
                <Stack size={14} weight="bold" />
                Itens Inclusos no Combo
              </p>
              <ul className="mt-2 space-y-1.5">
                {bundleItems.map((b) => (
                  <li
                    key={b.id}
                    className="flex items-center justify-between gap-2 text-xs text-violet-950/90 dark:text-violet-100/90"
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      <Package size={13} className="shrink-0 text-violet-500" />
                      <span className="truncate">{b.title}</span>
                    </span>
                    <span className="shrink-0 font-mono text-[11px] font-semibold text-violet-700 dark:text-violet-300">
                      {formatNullpassPrice(b)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {bumpItems.length > 0 && isVip && !locked && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-3.5 dark:border-amber-900/40 dark:bg-amber-950/20">
              <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
                Ofertas Bônus Disponíveis (Order Bumps)
              </p>
              <p className="mt-0.5 text-[11px] text-amber-800/80 dark:text-amber-200/80">
                Adicionais exclusivos disponíveis no checkout.
              </p>
              <ul className="mt-2 space-y-1.5">
                {bumpItems.map((b) => (
                  <li
                    key={b.id}
                    className="flex items-center justify-between gap-2 text-xs text-amber-950 dark:text-amber-100"
                  >
                    <span className="truncate">{b.title}</span>
                    <span className="shrink-0 font-mono text-[11px] font-bold text-amber-700 dark:text-amber-300">
                      + {formatNullpassPrice(b)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <ul className="space-y-2 pt-1">
            {product.features.map((f) => (
              <li
                key={f}
                className="flex items-start gap-2 text-xs leading-relaxed text-neutral-700 dark:text-zinc-300"
              >
                <Sparkle
                  size={14}
                  weight="fill"
                  className="mt-0.5 shrink-0 text-amber-500"
                  aria-hidden
                />
                <span>{f}</span>
              </li>
            ))}
          </ul>

          {isVip && !locked && (
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3.5 dark:border-zinc-800 dark:bg-zinc-900/60">
              <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                Instruções de Liberação
              </p>
              <p className="mt-1 text-xs leading-relaxed text-neutral-600 dark:text-zinc-300">
                {product.vipFulfillmentNote}
              </p>
            </div>
          )}

          {locked && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3.5 dark:border-amber-900/40 dark:bg-amber-950/30">
              <p className="flex items-center gap-1.5 text-xs font-bold text-amber-900 dark:text-amber-200">
                <Lock size={14} weight="bold" />
                Exclusivo para Assinantes VIP
              </p>
              <p className="mt-1 text-xs leading-relaxed text-amber-800/80 dark:text-amber-200/80">
                O NullPass é o cofre restrito da comunidade. Assine o Plano VIP para liberar ferramentas com preço de custo para membros.
              </p>
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-2 border-t border-neutral-200 p-4 dark:border-zinc-800 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose} className="rounded-full">
            Fechar
          </Button>
          {locked ? (
            <Link href="/pricing" className="sm:min-w-[10rem]">
              <Button type="button" className="w-full rounded-full gap-1.5 font-semibold">
                <CrownSimple size={15} weight="fill" className="text-amber-400" />
                Assinar VIP
              </Button>
            </Link>
          ) : (
            <Button
              type="button"
              onClick={onRequest}
              className="sm:min-w-[10rem] rounded-full gap-1.5 font-semibold"
            >
              <Key size={15} weight="bold" />
              Comprar / Solicitar
            </Button>
          )}
        </div>
      </motion.div>
    </div>,
    document.body
  );
}

function NullpassPageInner() {
  const { isVip, user } = useAuth();
  const vip = !!isVip || user?.role === "admin" || user?.role === "vip";
  const locked = !vip;
  const searchParams = useSearchParams();
  const focusId = searchParams.get("id");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [payOpen, setPayOpen] = useState(false);

  const loadPublic = useNullpassStore((s) => s.loadPublic);
  const getById = useNullpassStore((s) => s.getById);
  const allProducts = useNullpassStore((s) => s.products);
  const hasHydrated = useNullpassStore((s) => s.hasHydrated);

  useEffect(() => {
    void loadPublic();
  }, [loadPublic]);

  const products = useMemo(
    () =>
      allProducts
        .filter((p) => p.active !== false)
        .slice()
        .sort(compareNullpassProducts),
    [allProducts]
  );

  const categories = useMemo(
    () => nullpassCategories(products),
    [products]
  );
  const featured = useMemo(
    () => nullpassFeatured(products, 6),
    [products]
  );

  const active = activeId ? (getById(activeId) ?? null) : null;

  useEffect(() => {
    if (!focusId || !hasHydrated) return;
    if (getById(focusId)) queueMicrotask(() => setActiveId(focusId));
  }, [focusId, getById, hasHydrated]);

  const openProduct = useCallback((id: string) => {
    setActiveId(id);
  }, []);

  async function handleRequest() {
    if (!active || locked) return;
    const price = effectiveNullpassPrice(active);
    if (price != null && price > 0) {
      setPayOpen(true);
      return;
    }
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

  const payPrice = active ? effectiveNullpassPrice(active) : null;
  const payProductKey = active ? `nullpass_${active.id}` : "nullpass_item";

  const catalogPreview = (
    <div className="space-y-8">
      {featured.length > 0 && (
        <NetflixRow
          title="Em Destaque no Vault"
          products={featured}
          locked={locked}
          featured
          onOpen={openProduct}
        />
      )}
      {categories.map((cat) => (
        <NetflixRow
          key={cat}
          title={cat}
          products={nullpassByCategory(cat, products)}
          locked={locked}
          onOpen={openProduct}
        />
      ))}
    </div>
  );

  return (
    <div className="app-page mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      {/* Header section */}
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-200/80 bg-amber-50/80 px-3 py-1 text-[12px] font-semibold text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300 mb-3">
            <Vault size={15} weight="fill" />
            Cofre de Benefícios & Acessos VIP
          </div>
          <h1 className="font-display text-[1.75rem] font-semibold tracking-tight text-[#1f1f1f] dark:text-zinc-50 sm:text-[2.25rem]">
            NullPass Vault
          </h1>
          <p className="mt-2 max-w-[55ch] text-[14px] leading-relaxed text-neutral-500 dark:text-zinc-400">
            Acessos exclusivos e ferramentas gerenciadas com <strong className="font-semibold text-neutral-800 dark:text-zinc-200">preço de custo para membros VIP</strong>. Liberação direta com a equipe staff.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <VipBadge />
            <span className="text-xs text-neutral-400 dark:text-zinc-500 font-medium">
              {hasHydrated
                ? `${products.length} benefícios no catálogo`
                : "Carregando catálogo…"}
            </span>
            {user?.role === "admin" && (
              <Link
                href="https://panel.nullysh.com/nullpass"
                className="text-xs font-semibold text-sky-600 hover:underline dark:text-sky-400 ml-1"
              >
                Editar no Nullysh Panel
              </Link>
            )}
          </div>
        </div>
      </header>

      {toast && (
        <div
          role="status"
          className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300 shadow-xs"
        >
          {toast}
        </div>
      )}

      {/* Main Glass Vault Card Container */}
      <div className="rounded-3xl border border-neutral-200/90 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-[#141414] sm:p-7">
        {!hasHydrated ? (
          <NullpassCatalogSkeleton />
        ) : products.length === 0 ? (
          <EmptyState
            icon={<Vault size={28} weight="duotone" />}
            title="Vault vazio"
            description={
              user?.role === "admin"
                ? "Cadastre produtos no Nullysh Panel → NullPass."
                : "Em breve novos benefícios entram no NullPass."
            }
            action={
              user?.role === "admin" ? (
                <a
                  href="https://panel.nullysh.com/nullpass"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button size="sm" className="rounded-full font-semibold">Abrir Nullysh Panel</Button>
                </a>
              ) : undefined
            }
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
      </div>

      {/* Security & Compliance Footnote */}
      <aside className="mt-6 flex items-start gap-2.5 rounded-2xl border border-neutral-200/60 bg-neutral-50/60 p-4 dark:border-zinc-800/60 dark:bg-[#141414]/60">
        <ShieldCheck size={16} className="mt-0.5 shrink-0 text-neutral-400 dark:text-zinc-500" />
        <p className="text-xs leading-relaxed text-neutral-400 dark:text-zinc-500">
          O NullPass oferece benefícios operados pela comunidade Nullysh. O uso deve respeitar os termos de cada plataforma. A equipe staff gerencia solicitações para manter a segurança do clube.
        </p>
      </aside>

      <AnimatePresence>
        {active && typeof document !== "undefined" && (
          <ProductModal
            key={active.id}
            product={active}
            locked={locked}
            isVip={vip}
            catalog={allProducts}
            onClose={() => setActiveId(null)}
            onRequest={handleRequest}
          />
        )}
      </AnimatePresence>

      {active && payPrice != null && payPrice > 0 && (
        <PlatformPaymentModal
          open={payOpen}
          onClose={() => setPayOpen(false)}
          kind="nullpass"
          productKey={payProductKey}
          title={active.title}
          listPriceBrl={payPrice}
          onPaid={() => {
            setPayOpen(false);
            setToast("Pagamento aprovado!");
            setActiveId(null);
          }}
        />
      )}
    </div>
  );
}

export default function NullpassPage() {
  return (
    <Suspense
      fallback={
        <div className="app-page mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
          <div className="mb-6 h-8 w-64 animate-pulse rounded bg-neutral-200 dark:bg-zinc-800" />
          <div className="rounded-3xl border border-neutral-200/90 bg-white p-6 dark:border-zinc-800 dark:bg-[#141414]">
            <NullpassCatalogSkeleton />
          </div>
        </div>
      }
    >
      <NullpassPageInner />
    </Suspense>
  );
}
