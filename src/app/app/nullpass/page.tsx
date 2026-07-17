"use client";

/**
 * NullPass — Vault VIP (UX Netflix em cards).
 * Visual alinhado ao resto do fórum: fundo claro, bordas arredondadas, surfaces brancas.
 * Free vê vitrine borrada + gate; VIP vê catálogo e solicita benefício.
 *
 * Fase A: thumbnails resilientes, isPinned, skeleton de hidratação.
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
  CaretRight,
  CrownSimple,
  Key,
  Lock,
  Package,
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
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        badge === "novo" && "bg-sky-500 text-white",
        badge === "custo-membro" && "bg-amber-400 text-[#1f1f1f]",
        badge === "limitado" &&
          "bg-white text-[#1f1f1f] ring-1 ring-black/10"
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
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
      ) : (
        <div
          className="absolute inset-0 flex items-center justify-center"
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
        className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-black/5"
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
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [product.coverUrl, product.id]);

  const showCover = Boolean(product.coverUrl) && !imgFailed;

  return (
    <motion.button
      type="button"
      onClick={onOpen}
      whileHover={reduce || locked ? undefined : { scale: 1.03 }}
      whileTap={reduce ? undefined : { scale: 0.98 }}
      className={cn(
        "group relative shrink-0 overflow-hidden text-left",
        "rounded-2xl border border-neutral-200/90 bg-white",
        "shadow-[0_1px_2px_rgb(0_0_0/0.04)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f1f1f]/25 focus-visible:ring-offset-2",
        featured
          ? "aspect-[16/10] w-[min(100%,320px)] sm:w-[340px]"
          : "aspect-[2/3] w-[132px] sm:w-[148px] md:w-[160px]"
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
          <span className="inline-flex items-center rounded-md bg-[#1f1f1f] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
            Fixado
          </span>
        )}
        {product.badge && <BadgePill badge={product.badge} />}
        {product.kind === "combo" && (
          <span className="inline-flex items-center rounded-md bg-violet-500 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
            Combo
          </span>
        )}
        {product.promoActive && (
          <span className="inline-flex items-center rounded-md bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
            Promo
          </span>
        )}
      </div>

      {locked && (
        <div className="absolute right-2.5 top-2.5 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white backdrop-blur-sm">
          <Lock size={14} weight="bold" aria-hidden />
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 z-10 p-3">
        {/* Monograma no rodapé só com capa real; fallback já centraliza o monograma */}
        {showCover && (
          <span
            className={cn(
              "mb-2 flex items-center justify-center rounded-xl bg-white/15 font-display text-white backdrop-blur-sm ring-1 ring-white/20",
              featured ? "h-12 w-12 text-lg" : "h-9 w-9 text-[13px]"
            )}
            aria-hidden
          >
            {product.monogram}
          </span>
        )}
        <p
          className={cn(
            "font-semibold tracking-tight text-white",
            featured ? "text-[16px]" : "line-clamp-2 text-[13px]"
          )}
        >
          {product.title}
        </p>
        {featured && (
          <p className="mt-0.5 line-clamp-2 text-[12px] text-white/75">
            {product.tagline}
          </p>
        )}
        <p className="mt-1 flex flex-wrap items-baseline gap-1.5 text-[12px] font-semibold text-white">
          {formatNullpassCompareAt(product) && (
            <span className="text-[11px] font-medium text-white/55 line-through">
              {formatNullpassCompareAt(product)}
            </span>
          )}
          <span>{formatNullpassPrice(product)}</span>
        </p>
      </div>

      <div
        className={cn(
          "absolute inset-0 z-20 flex items-center justify-center bg-black/30 opacity-0 transition",
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
      <h2 className="px-0.5 text-[15px] font-semibold tracking-tight text-[#1f1f1f] dark:text-zinc-100 sm:text-[16px]">
        {title}
      </h2>
      {/* overflow-y-hidden + py generoso: scale do card não “vaza” cortando cantos */}
      <div
        className={cn(
          "flex gap-3 overflow-x-auto overflow-y-hidden py-3 thin-scroll",
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
          : "aspect-[2/3] w-[132px] sm:w-[148px] md:w-[160px]"
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
        <div className="flex gap-3 overflow-hidden py-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <PosterSkeleton key={`f-${i}`} featured />
          ))}
        </div>
      </section>
      {Array.from({ length: 2 }).map((_, row) => (
        <section key={row} className="space-y-3">
          <div className="h-4 w-32 animate-pulse rounded bg-neutral-200 dark:bg-zinc-800" />
          <div className="flex gap-3 overflow-hidden py-3">
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
  const [imgFailed, setImgFailed] = useState(false);
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
    setImgFailed(false);
  }, [product.coverUrl, product.id]);

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
        className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
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
          "rounded-t-2xl bg-white text-[#1f1f1f] shadow-[var(--shadow-lg)] sm:rounded-2xl",
          "border border-neutral-200/90 dark:border-zinc-700 dark:bg-[#141414] dark:text-zinc-100"
        )}
      >
        <div
          className="relative h-40 shrink-0 overflow-hidden sm:h-48"
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
          <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-black/10 dark:from-[#141414]" />
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white backdrop-blur-sm transition hover:bg-black/70"
            aria-label="Fechar"
          >
            <X size={18} weight="bold" />
          </button>
          <div className="absolute bottom-3 left-4 flex items-end gap-3">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 text-lg font-semibold text-white backdrop-blur-sm ring-1 ring-white/25">
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
                className="font-display text-[20px] font-semibold tracking-tight text-white sm:text-[22px]"
                style={{ textShadow: "0 1px 8px rgb(0 0 0 / 0.35)" }}
              >
                {product.title}
              </h2>
            </div>
          </div>
        </div>

        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          <p className="text-[14px] leading-relaxed text-neutral-600 dark:text-zinc-300">
            {product.tagline}
          </p>
          <p className="mt-3 text-[13px] leading-relaxed text-neutral-500 dark:text-zinc-400">
            {product.description}
          </p>

          <div className="mt-4 flex flex-wrap items-baseline gap-2">
            {compareAt && (
              <span className="text-[13px] font-medium text-neutral-400 line-through">
                {compareAt}
              </span>
            )}
            <span className="text-[15px] font-semibold text-[#1f1f1f] dark:text-zinc-100">
              {formatNullpassPrice(product)}
            </span>
            {product.promoActive && (
              <span className="rounded-md bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-rose-700">
                Promo
              </span>
            )}
            {product.priceHint && (
              <span className="text-[12px] text-neutral-400">
                {product.priceHint}
              </span>
            )}
            <VipBadge />
          </div>

          {product.kind === "combo" && bundleItems.length > 0 && (
            <div className="mt-4 rounded-2xl border border-violet-200 bg-violet-50/80 p-3 dark:border-violet-900/40 dark:bg-violet-950/20">
              <p className="flex items-center gap-1.5 text-[12px] font-semibold text-violet-900 dark:text-violet-200">
                <Stack size={14} weight="bold" />
                Itens do combo
              </p>
              <ul className="mt-2 space-y-1">
                {bundleItems.map((b) => (
                  <li
                    key={b.id}
                    className="flex items-center justify-between gap-2 text-[13px] text-violet-950/80 dark:text-violet-100/80"
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      <Package size={12} className="shrink-0" />
                      <span className="truncate">{b.title}</span>
                    </span>
                    <span className="shrink-0 text-[11px] font-medium text-violet-700/80">
                      {formatNullpassPrice(b)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {bumpItems.length > 0 && isVip && !locked && (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/80 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
              <p className="text-[12px] font-semibold text-amber-900 dark:text-amber-200">
                Order bumps disponíveis
              </p>
              <p className="mt-0.5 text-[11px] text-amber-800/75 dark:text-amber-100/70">
                Ofertas extras no checkout (Nullysh Pay).
              </p>
              <ul className="mt-2 space-y-1">
                {bumpItems.map((b) => (
                  <li
                    key={b.id}
                    className="flex items-center justify-between gap-2 text-[13px] text-amber-950/85 dark:text-amber-50/85"
                  >
                    <span className="truncate">{b.title}</span>
                    <span className="shrink-0 text-[11px] font-semibold">
                      + {formatNullpassPrice(b)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <ul className="mt-4 space-y-2">
            {product.features.map((f) => (
              <li
                key={f}
                className="flex gap-2 text-[13px] leading-snug text-neutral-700 dark:text-zinc-300"
              >
                <Sparkle
                  size={14}
                  weight="fill"
                  className="mt-0.5 shrink-0 text-amber-500"
                  aria-hidden
                />
                {f}
              </li>
            ))}
          </ul>

          {isVip && !locked && (
            <div className="mt-5 rounded-2xl border border-neutral-200 bg-neutral-50 p-3 dark:border-zinc-700 dark:bg-zinc-900">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                Como liberar
              </p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-600 dark:text-zinc-300">
                {product.vipFulfillmentNote}
              </p>
            </div>
          )}

          {locked && (
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/40 dark:bg-amber-950/30">
              <p className="flex items-center gap-1.5 text-[13px] font-semibold text-amber-900 dark:text-amber-200">
                <Lock size={14} weight="bold" />
                Exclusivo do Vault VIP
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-amber-800/80 dark:text-amber-100/75">
                O NullPass é o cofre de benefícios do clube. Assine o VIP para
                solicitar acessos gerenciados com preço de custo para membros.
              </p>
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-2 border-t border-neutral-200 p-4 dark:border-zinc-800 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
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
            <Button
              type="button"
              onClick={onRequest}
              className="sm:min-w-[10rem]"
            >
              <Key size={15} weight="bold" />
              Comprar / solicitar
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
    if (getById(focusId)) setActiveId(focusId);
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
  /** productKey canônico → Pay resolve preço no D1 do Forum (nullpass_{id}) */
  const payProductKey = active ? `nullpass_${active.id}` : "nullpass_item";

  const catalogPreview = (
    <div className="space-y-8">
      {featured.length > 0 && (
        <NetflixRow
          title="Em destaque no Vault"
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
      <header className="mb-6">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500 shadow-[0_1px_2px_rgb(0_0_0/0.04)] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
          <Vault
            size={14}
            weight="fill"
            className="text-[#1f1f1f] dark:text-zinc-200"
          />
          NullPass · Vault
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Seu cofre de benefícios VIP
        </h1>
        <p className="mt-2 max-w-xl text-base leading-relaxed text-neutral-600 dark:text-zinc-400">
          Acessos e assinaturas de ferramentas selecionadas, com{" "}
          <strong className="font-medium text-neutral-800 dark:text-zinc-200">
            preço de custo para membros
          </strong>
          . Liberação{" "}
          <strong className="font-medium text-neutral-800 dark:text-zinc-200">
            gerenciada pelo staff
          </strong>{" "}
          — benefício do clube, não vitrine pública de contas.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <VipBadge />
          <span className="text-[12px] text-neutral-400">
            {hasHydrated
              ? `${products.length} benefícios no catálogo`
              : "Carregando catálogo…"}
          </span>
          {user?.role === "admin" && (
            <Link
              href="https://panel.nullysh.com/nullpass"
              className="text-[12px] font-semibold text-sky-600 hover:underline"
            >
              Editar no Nullysh Panel
            </Link>
          )}
        </div>
      </header>

      {toast && (
        <div
          role="status"
          className="mb-4 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700 shadow-[0_1px_2px_rgb(0_0_0/0.04)] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
        >
          {toast}
        </div>
      )}

      <div className="rounded-2xl border border-neutral-200/90 bg-white p-4 shadow-[0_1px_2px_rgb(0_0_0/0.04)] dark:border-zinc-800 dark:bg-[#141414] sm:p-6">
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
                  <Button size="sm">Abrir Nullysh Panel</Button>
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

      <p className="mt-6 max-w-2xl text-[11px] leading-relaxed text-neutral-400">
        NullPass oferece benefícios operados pelo Nullysh. O uso deve respeitar
        os termos de cada plataforma. O staff pode recusar, pausar ou enfileirar
        solicitações para manter o clube seguro e em conformidade.
      </p>

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
          <div className="rounded-2xl border border-neutral-200/90 bg-white p-4 sm:p-6 dark:border-zinc-800 dark:bg-[#141414]">
            <NullpassCatalogSkeleton />
          </div>
        </div>
      }
    >
      <NullpassPageInner />
    </Suspense>
  );
}
