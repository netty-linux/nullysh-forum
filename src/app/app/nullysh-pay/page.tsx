"use client";

/**
 * Nullysh Pay — gateway do membro (dashboard estilo Pagar.me / Stripe).
 * Estética Nullysh: fundo claro, cards arredondados.
 * Config de API Asaas fica só no Painel ADM.
 */

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { NULLYSH_PAY_BRAND } from "@/lib/nullysh-pay/config";
import {
  formatPayBRL,
  useNullyshPayMerchantStore,
  type OfferInput,
  type ProductInput,
} from "@/lib/nullysh-pay/merchant-store";
import {
  NP_OFFER_STATUS_LABEL,
  NP_PRODUCT_STATUS_LABEL,
  NP_PRODUCT_TYPE_LABEL,
  NP_SALE_STATUS_LABEL,
  type NullyshPayOffer,
  type NullyshPayOfferStatus,
  type NullyshPayProduct,
  type NullyshPayProductStatus,
  type NullyshPayProductType,
} from "@/lib/nullysh-pay/types";
import {
  ChartLineUp,
  CurrencyCircleDollar,
  Package,
  PencilSimple,
  Plus,
  Receipt,
  Storefront,
  Tag,
  Trash,
  TrendUp,
} from "@phosphor-icons/react";
import Image from "next/image";
import { useMemo, useState } from "react";

type DashTab = "overview" | "products" | "offers" | "sales";

const PRODUCT_TYPES: NullyshPayProductType[] = [
  "digital",
  "course",
  "subscription",
  "service",
  "other",
];

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ size?: number; className?: string; weight?: "bold" | "fill" }>;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200/90 bg-white p-4 shadow-[0_1px_2px_rgb(0_0_0/0.04)] dark:border-zinc-800 dark:bg-[#141414]">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[12px] font-medium text-neutral-500">{label}</p>
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-neutral-100 text-neutral-600 dark:bg-zinc-800 dark:text-zinc-300">
          <Icon size={16} weight="bold" />
        </span>
      </div>
      <p className="mt-2 text-xl font-semibold tabular-nums tracking-tight text-[#1f1f1f] dark:text-zinc-50">
        {value}
      </p>
      {hint && (
        <p className="mt-0.5 text-[11px] text-neutral-400">{hint}</p>
      )}
    </div>
  );
}

export default function NullyshPayPage() {
  const { user } = useAuth();
  const ownerId = user?.id || "";

  const productsAll = useNullyshPayMerchantStore((s) => s.products);
  const offersAll = useNullyshPayMerchantStore((s) => s.offers);
  const salesAll = useNullyshPayMerchantStore((s) => s.sales);
  const createProduct = useNullyshPayMerchantStore((s) => s.createProduct);
  const updateProduct = useNullyshPayMerchantStore((s) => s.updateProduct);
  const deleteProduct = useNullyshPayMerchantStore((s) => s.deleteProduct);
  const createOffer = useNullyshPayMerchantStore((s) => s.createOffer);
  const updateOffer = useNullyshPayMerchantStore((s) => s.updateOffer);
  const deleteOffer = useNullyshPayMerchantStore((s) => s.deleteOffer);
  const addDemoSale = useNullyshPayMerchantStore((s) => s.addDemoSale);

  const products = useMemo(
    () =>
      productsAll
        .filter((p) => p.ownerId === ownerId)
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        ),
    [productsAll, ownerId]
  );
  const offers = useMemo(
    () =>
      offersAll
        .filter((o) => o.ownerId === ownerId)
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        ),
    [offersAll, ownerId]
  );
  const sales = useMemo(
    () =>
      salesAll
        .filter((s) => s.ownerId === ownerId)
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ),
    [salesAll, ownerId]
  );

  const [tab, setTab] = useState<DashTab>("overview");
  const [toast, setToast] = useState("");
  const [productForm, setProductForm] = useState<"new" | string | null>(null);
  const [offerForm, setOfferForm] = useState<"new" | string | null>(null);

  // product form fields
  const [pTitle, setPTitle] = useState("");
  const [pDesc, setPDesc] = useState("");
  const [pType, setPType] = useState<NullyshPayProductType>("digital");
  const [pPrice, setPPrice] = useState("");
  const [pPromo, setPPromo] = useState("");
  const [pPromoOn, setPPromoOn] = useState(false);
  const [pDelivery, setPDelivery] = useState("");
  const [pStatus, setPStatus] = useState<NullyshPayProductStatus>("active");
  const [pError, setPError] = useState("");

  // offer form
  const [oProductId, setOProductId] = useState("");
  const [oName, setOName] = useState("");
  const [oHeadline, setOHeadline] = useState("");
  const [oPrice, setOPrice] = useState("");
  const [oPromo, setOPromo] = useState("");
  const [oPromoOn, setOPromoOn] = useState(false);
  const [oStatus, setOStatus] = useState<NullyshPayOfferStatus>("active");
  const [oError, setOError] = useState("");

  function flash(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(""), 2800);
  }

  const paidSales = sales.filter((s) => s.status === "paid");
  const revenue = paidSales.reduce((acc, s) => acc + s.amount, 0);
  const pending = sales.filter((s) => s.status === "pending").length;
  const activeProducts = products.filter((p) => p.status === "active").length;
  const activeOffers = offers.filter((o) => o.status === "active").length;

  function resetProductForm() {
    setPTitle("");
    setPDesc("");
    setPType("digital");
    setPPrice("");
    setPPromo("");
    setPPromoOn(false);
    setPDelivery("");
    setPStatus("active");
    setPError("");
  }

  function openProductEdit(p?: NullyshPayProduct) {
    if (!p) {
      resetProductForm();
      setProductForm("new");
      return;
    }
    setPTitle(p.title);
    setPDesc(p.description);
    setPType(p.type);
    setPPrice(String(p.price));
    setPPromo(p.promoPrice != null ? String(p.promoPrice) : "");
    setPPromoOn(!!p.promoActive);
    setPDelivery(p.deliveryUrl || "");
    setPStatus(p.status);
    setPError("");
    setProductForm(p.id);
  }

  function saveProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!ownerId) return;
    const price = Number(String(pPrice).replace(",", "."));
    const promo = pPromo.trim()
      ? Number(String(pPromo).replace(",", "."))
      : null;
    const input: ProductInput = {
      title: pTitle,
      description: pDesc,
      type: pType,
      price,
      promoPrice: promo,
      promoActive: pPromoOn,
      deliveryUrl: pDelivery || null,
      status: pStatus,
    };
    if (productForm && productForm !== "new") {
      const res = updateProduct(ownerId, productForm, input);
      if (!res.ok) {
        setPError(res.error);
        return;
      }
      flash(`Produto “${res.product.title}” atualizado.`);
    } else {
      const res = createProduct(ownerId, input);
      if (!res.ok) {
        setPError(res.error);
        return;
      }
      flash(`Produto “${res.product.title}” criado.`);
    }
    setProductForm(null);
    resetProductForm();
  }

  function resetOfferForm() {
    setOProductId(products[0]?.id || "");
    setOName("");
    setOHeadline("");
    setOPrice("");
    setOPromo("");
    setOPromoOn(false);
    setOStatus("active");
    setOError("");
  }

  function openOfferEdit(o?: NullyshPayOffer) {
    if (!o) {
      resetOfferForm();
      setOfferForm("new");
      return;
    }
    setOProductId(o.productId);
    setOName(o.name);
    setOHeadline(o.headline);
    setOPrice(String(o.price));
    setOPromo(o.promoPrice != null ? String(o.promoPrice) : "");
    setOPromoOn(!!o.promoActive);
    setOStatus(o.status);
    setOError("");
    setOfferForm(o.id);
  }

  function saveOffer(e: React.FormEvent) {
    e.preventDefault();
    if (!ownerId) return;
    const input: OfferInput = {
      productId: oProductId,
      name: oName,
      headline: oHeadline,
      price: Number(String(oPrice).replace(",", ".")),
      promoPrice: oPromo.trim()
        ? Number(String(oPromo).replace(",", "."))
        : null,
      promoActive: oPromoOn,
      status: oStatus,
    };
    if (offerForm && offerForm !== "new") {
      const res = updateOffer(ownerId, offerForm, input);
      if (!res.ok) {
        setOError(res.error);
        return;
      }
      flash(`Oferta “${res.offer.name}” atualizada.`);
    } else {
      const res = createOffer(ownerId, input);
      if (!res.ok) {
        setOError(res.error);
        return;
      }
      flash(`Oferta “${res.offer.name}” criada.`);
    }
    setOfferForm(null);
    resetOfferForm();
  }

  if (!user) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-neutral-400">
        Carregando…
      </div>
    );
  }

  const tabs: { id: DashTab; label: string }[] = [
    { id: "overview", label: "Visão geral" },
    { id: "products", label: `Produtos (${products.length})` },
    { id: "offers", label: `Ofertas (${offers.length})` },
    { id: "sales", label: `Vendas (${sales.length})` },
  ];

  const firstName = user.name?.trim().split(/\s+/)[0] || "";

  return (
    <div className="app-page mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-6">
        <div className="mb-4 flex items-center gap-3">
          <span className="relative flex h-12 w-12 shrink-0 items-center justify-center sm:h-14 sm:w-14">
            <Image
              src="/brand/nullysh-pay-logo.png"
              alt={NULLYSH_PAY_BRAND.name}
              width={56}
              height={56}
              className="h-full w-full object-contain"
              priority
            />
          </span>
          <div className="min-w-0">
            <p className="font-display text-[20px] font-semibold leading-tight tracking-[-0.02em] text-[#1f1f1f] dark:text-zinc-100 sm:text-[24px]">
              {NULLYSH_PAY_BRAND.name}
            </p>
            <p className="mt-0.5 text-[13px] text-neutral-500 dark:text-zinc-500">
              Painel do vendedor
            </p>
          </div>
        </div>
        <h1 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.02em] text-black text-balance sm:text-[32px] dark:text-zinc-50">
          {firstName
            ? `Bem-vindo de volta, ${firstName}`
            : "Bem-vindo ao Nullysh Pay"}
        </h1>
        <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-neutral-600 dark:text-zinc-400">
          Gerencie produtos, ofertas e recebimentos em um só lugar. Monte sua
          vitrine, lance campanhas e acompanhe cada venda com clareza.
        </p>
      </header>

      {toast && (
        <div
          role="status"
          className="mb-4 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-medium text-[#1f1f1f] shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        >
          {toast}
        </div>
      )}

      {/* Tabs */}
      <div className="mb-5 overflow-x-auto thin-scroll rounded-xl bg-neutral-200/60 p-1 dark:bg-zinc-800/80">
        <div className="flex min-w-min flex-nowrap gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={
                tab === t.id
                  ? "chip shrink-0 whitespace-nowrap rounded-lg bg-white px-3 py-2 text-xs font-semibold text-[#1f1f1f] shadow-sm sm:text-sm dark:bg-zinc-900 dark:text-zinc-50"
                  : "chip shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium text-neutral-500 hover:text-[#1f1f1f] sm:text-sm dark:text-zinc-400 dark:hover:text-zinc-100"
              }
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Overview */}
      {tab === "overview" && (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Receita (pago)"
              value={formatPayBRL(revenue)}
              hint={`${paidSales.length} venda(s) paga(s)`}
              icon={CurrencyCircleDollar}
            />
            <StatCard
              label="Pendentes"
              value={String(pending)}
              hint="Aguardando pagamento"
              icon={Receipt}
            />
            <StatCard
              label="Produtos ativos"
              value={String(activeProducts)}
              hint={`${products.length} no total`}
              icon={Package}
            />
            <StatCard
              label="Ofertas ativas"
              value={String(activeOffers)}
              hint={`${offers.length} no total`}
              icon={Tag}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04)] dark:border-zinc-800 dark:bg-[#141414]">
              <p className="flex items-center gap-2 text-sm font-semibold text-[#1f1f1f] dark:text-zinc-100">
                <TrendUp size={18} weight="bold" />
                Primeiros passos
              </p>
              <ol className="mt-3 list-decimal space-y-2 pl-4 text-[13px] leading-relaxed text-neutral-600 dark:text-zinc-400">
                <li>Cadastre o que você vende — curso, e-book, mentoria…</li>
                <li>Crie uma oferta com preço e, se quiser, promoção</li>
                <li>Compartilhe o link e acompanhe os recebimentos aqui</li>
              </ol>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setTab("products");
                    openProductEdit();
                  }}
                >
                  <Plus size={15} weight="bold" />
                  Novo produto
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setTab("offers");
                    openOfferEdit();
                  }}
                  disabled={products.length === 0}
                >
                  <Tag size={15} weight="bold" />
                  Nova oferta
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04)] dark:border-zinc-800 dark:bg-[#141414]">
              <p className="flex items-center gap-2 text-sm font-semibold text-[#1f1f1f] dark:text-zinc-100">
                <Storefront size={18} weight="bold" />
                Feito para quem vende
              </p>
              <ul className="mt-3 space-y-2 text-[13px] leading-relaxed text-neutral-600 dark:text-zinc-400">
                <li>
                  · Infoprodutos, cursos e serviços com checkout próprio
                </li>
                <li>
                  · Ofertas e campanhas com preço promocional em um clique
                </li>
                <li>
                  · Visão clara de receita, pendências e histórico de vendas
                </li>
              </ul>
              {products[0] && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-4"
                  onClick={() => {
                    const res = addDemoSale(
                      ownerId,
                      products[0].id,
                      products[0].promoActive && products[0].promoPrice != null
                        ? products[0].promoPrice
                        : products[0].price
                    );
                    if (res.ok) {
                      flash("Venda de demonstração registrada.");
                      setTab("sales");
                    } else flash(res.error);
                  }}
                >
                  Registrar venda demo
                </Button>
              )}
            </div>
          </div>

          {sales.length > 0 && (
            <div className="rounded-2xl border border-neutral-200/90 bg-white p-5 dark:border-zinc-800 dark:bg-[#141414]">
              <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#1f1f1f] dark:text-zinc-100">
                <ChartLineUp size={18} weight="bold" />
                Últimas vendas
              </p>
              <ul className="divide-y divide-neutral-100 dark:divide-zinc-800">
                {sales.slice(0, 5).map((s) => {
                  const prod = products.find((p) => p.id === s.productId);
                  return (
                    <li
                      key={s.id}
                      className="flex items-center justify-between gap-3 py-2.5 text-[13px]"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-[#1f1f1f] dark:text-zinc-100">
                          {prod?.title || "Produto"}
                        </p>
                        <p className="text-[11px] text-neutral-400">
                          {s.buyerName} ·{" "}
                          {new Date(s.createdAt).toLocaleString("pt-BR")}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-semibold tabular-nums">
                          {formatPayBRL(s.amount)}
                        </p>
                        <p className="text-[11px] text-neutral-400">
                          {NP_SALE_STATUS_LABEL[s.status]}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Products */}
      {tab === "products" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-neutral-500">
              Cursos, e-books, mentorias, assinaturas…
            </p>
            <Button type="button" size="sm" onClick={() => openProductEdit()}>
              <Plus size={15} weight="bold" />
              Novo produto
            </Button>
          </div>

          {productForm && (
            <form
              onSubmit={saveProduct}
              className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5 dark:border-zinc-800 dark:bg-[#141414]"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[#1f1f1f] dark:text-zinc-100">
                  {productForm === "new" ? "Novo produto" : "Editar produto"}
                </h3>
                <button
                  type="button"
                  className="text-[13px] text-neutral-500 hover:text-[#1f1f1f]"
                  onClick={() => {
                    setProductForm(null);
                    resetProductForm();
                  }}
                >
                  Cancelar
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="Título"
                  value={pTitle}
                  onChange={(e) => setPTitle(e.target.value)}
                  required
                  placeholder="Ex.: Curso de Copy"
                />
                <label className="block space-y-1.5">
                  <span className="text-[12px] font-medium text-neutral-600">
                    Tipo
                  </span>
                  <select
                    value={pType}
                    onChange={(e) =>
                      setPType(e.target.value as NullyshPayProductType)
                    }
                    className="h-10 w-full rounded-[var(--radius-md)] border border-neutral-200 bg-white px-3 text-[14px] dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    {PRODUCT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {NP_PRODUCT_TYPE_LABEL[t]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <Textarea
                label="Descrição"
                value={pDesc}
                onChange={(e) => setPDesc(e.target.value)}
                className="min-h-[80px]"
                placeholder="O que o cliente recebe…"
              />
              <div className="grid gap-3 sm:grid-cols-3">
                <Input
                  label="Preço (R$)"
                  value={pPrice}
                  onChange={(e) => setPPrice(e.target.value)}
                  inputMode="decimal"
                  required
                />
                <Input
                  label="Preço promo (R$)"
                  value={pPromo}
                  onChange={(e) => setPPromo(e.target.value)}
                  inputMode="decimal"
                  placeholder="Opcional"
                />
                <label className="flex items-end gap-2 pb-1 text-[13px] font-medium">
                  <input
                    type="checkbox"
                    checked={pPromoOn}
                    onChange={(e) => setPPromoOn(e.target.checked)}
                    className="h-4 w-4 rounded"
                  />
                  Ativar promo
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="Link de entrega (privado)"
                  value={pDelivery}
                  onChange={(e) => setPDelivery(e.target.value)}
                  placeholder="https://… (área de membros, Drive…)"
                />
                <label className="block space-y-1.5">
                  <span className="text-[12px] font-medium text-neutral-600">
                    Status
                  </span>
                  <select
                    value={pStatus}
                    onChange={(e) =>
                      setPStatus(e.target.value as NullyshPayProductStatus)
                    }
                    className="h-10 w-full rounded-[var(--radius-md)] border border-neutral-200 bg-white px-3 text-[14px] dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    {(
                      Object.keys(
                        NP_PRODUCT_STATUS_LABEL
                      ) as NullyshPayProductStatus[]
                    ).map((s) => (
                      <option key={s} value={s}>
                        {NP_PRODUCT_STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {pError && (
                <p className="text-[13px] font-medium text-red-600">{pError}</p>
              )}
              <Button type="submit">Salvar produto</Button>
            </form>
          )}

          {products.length === 0 && !productForm ? (
            <EmptyState
              icon={<Package size={28} weight="duotone" />}
              title="Nenhum produto ainda"
              description="Cadastre o primeiro item para vender com Nullysh Pay."
              action={
                <Button size="sm" onClick={() => openProductEdit()}>
                  Criar produto
                </Button>
              }
            />
          ) : (
            <ul className="space-y-2">
              {products.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-col gap-3 rounded-2xl border border-neutral-200/90 bg-white p-4 sm:flex-row sm:items-center dark:border-zinc-800 dark:bg-[#141414]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-[#1f1f1f] dark:text-zinc-100">
                        {p.title}
                      </p>
                      <span className="rounded-md bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-neutral-600 dark:bg-zinc-800 dark:text-zinc-300">
                        {NP_PRODUCT_TYPE_LABEL[p.type]}
                      </span>
                      <span className="rounded-md bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-neutral-500 dark:bg-zinc-800">
                        {NP_PRODUCT_STATUS_LABEL[p.status]}
                      </span>
                      {p.promoActive && (
                        <span className="rounded-md bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-rose-700">
                          Promo
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[13px] tabular-nums text-neutral-500">
                      {p.promoActive && p.promoPrice != null ? (
                        <>
                          <span className="mr-1.5 line-through opacity-60">
                            {formatPayBRL(p.price)}
                          </span>
                          {formatPayBRL(p.promoPrice)}
                        </>
                      ) : (
                        formatPayBRL(p.price)
                      )}
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => openProductEdit(p)}
                    >
                      <PencilSimple size={15} />
                      Editar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:bg-red-50"
                      onClick={() => {
                        if (window.confirm(`Apagar “${p.title}”?`)) {
                          const r = deleteProduct(ownerId, p.id);
                          flash(r.ok ? "Produto removido." : r.error);
                        }
                      }}
                    >
                      <Trash size={15} weight="bold" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Offers */}
      {tab === "offers" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-neutral-500">
              Páginas de oferta com preço e checkout Nullysh Pay
            </p>
            <Button
              type="button"
              size="sm"
              onClick={() => openOfferEdit()}
              disabled={products.length === 0}
            >
              <Plus size={15} weight="bold" />
              Nova oferta
            </Button>
          </div>

          {products.length === 0 && (
            <p className="rounded-2xl border border-dashed border-neutral-300 bg-white p-6 text-center text-sm text-neutral-500">
              Crie um produto antes de montar ofertas.
            </p>
          )}

          {offerForm && products.length > 0 && (
            <form
              onSubmit={saveOffer}
              className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5 dark:border-zinc-800 dark:bg-[#141414]"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">
                  {offerForm === "new" ? "Nova oferta" : "Editar oferta"}
                </h3>
                <button
                  type="button"
                  className="text-[13px] text-neutral-500"
                  onClick={() => {
                    setOfferForm(null);
                    resetOfferForm();
                  }}
                >
                  Cancelar
                </button>
              </div>
              <label className="block space-y-1.5">
                <span className="text-[12px] font-medium text-neutral-600">
                  Produto
                </span>
                <select
                  value={oProductId}
                  onChange={(e) => setOProductId(e.target.value)}
                  className="h-10 w-full rounded-[var(--radius-md)] border border-neutral-200 bg-white px-3 text-[14px] dark:border-zinc-700 dark:bg-zinc-900"
                  required
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="Nome interno"
                  value={oName}
                  onChange={(e) => setOName(e.target.value)}
                  placeholder="Black Friday · 30 dias"
                  required
                />
                <Input
                  label="Headline (pública)"
                  value={oHeadline}
                  onChange={(e) => setOHeadline(e.target.value)}
                  placeholder="Garanta sua vaga com desconto"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Input
                  label="Preço (R$)"
                  value={oPrice}
                  onChange={(e) => setOPrice(e.target.value)}
                  required
                  inputMode="decimal"
                />
                <Input
                  label="Promo (R$)"
                  value={oPromo}
                  onChange={(e) => setOPromo(e.target.value)}
                  inputMode="decimal"
                />
                <label className="flex items-end gap-2 pb-1 text-[13px] font-medium">
                  <input
                    type="checkbox"
                    checked={oPromoOn}
                    onChange={(e) => setOPromoOn(e.target.checked)}
                    className="h-4 w-4 rounded"
                  />
                  Promo ativa
                </label>
              </div>
              <label className="block space-y-1.5">
                <span className="text-[12px] font-medium text-neutral-600">
                  Status
                </span>
                <select
                  value={oStatus}
                  onChange={(e) =>
                    setOStatus(e.target.value as NullyshPayOfferStatus)
                  }
                  className="h-10 w-full rounded-[var(--radius-md)] border border-neutral-200 bg-white px-3 text-[14px] dark:border-zinc-700 dark:bg-zinc-900"
                >
                  {(
                    Object.keys(NP_OFFER_STATUS_LABEL) as NullyshPayOfferStatus[]
                  ).map((s) => (
                    <option key={s} value={s}>
                      {NP_OFFER_STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </label>
              {oError && (
                <p className="text-[13px] font-medium text-red-600">{oError}</p>
              )}
              <Button type="submit">Salvar oferta</Button>
            </form>
          )}

          {offers.length === 0 && !offerForm ? (
            <EmptyState
              icon={<Tag size={28} weight="duotone" />}
              title="Nenhuma oferta"
              description="Crie uma oferta para rodar lançamentos e promoções."
            />
          ) : (
            <ul className="space-y-2">
              {offers.map((o) => {
                const prod = products.find((p) => p.id === o.productId);
                return (
                  <li
                    key={o.id}
                    className="flex flex-col gap-3 rounded-2xl border border-neutral-200/90 bg-white p-4 sm:flex-row sm:items-center dark:border-zinc-800 dark:bg-[#141414]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[#1f1f1f] dark:text-zinc-100">
                        {o.name}
                      </p>
                      <p className="text-[12px] text-neutral-500">
                        {prod?.title || "Produto"} ·{" "}
                        {NP_OFFER_STATUS_LABEL[o.status]} ·{" "}
                        {formatPayBRL(
                          o.promoActive && o.promoPrice != null
                            ? o.promoPrice
                            : o.price
                        )}
                      </p>
                      <p className="mt-1 truncate font-mono text-[11px] text-neutral-400">
                        /pay/{o.checkoutSlug}
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => openOfferEdit(o)}
                      >
                        <PencilSimple size={15} />
                        Editar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-red-600"
                        onClick={() => {
                          if (window.confirm(`Apagar oferta “${o.name}”?`)) {
                            const r = deleteOffer(ownerId, o.id);
                            flash(r.ok ? "Oferta removida." : r.error);
                          }
                        }}
                      >
                        <Trash size={15} weight="bold" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Sales */}
      {tab === "sales" && (
        <div className="space-y-4">
          {sales.length === 0 ? (
            <EmptyState
              icon={<Receipt size={28} weight="duotone" />}
              title="Sem vendas ainda"
              description="Quando o Asaas estiver ativo, as cobranças aparecem aqui. Até lá você pode simular uma venda demo na visão geral."
            />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white dark:border-zinc-800 dark:bg-[#141414]">
              <table className="w-full text-left text-[13px]">
                <thead className="border-b border-neutral-100 bg-neutral-50 text-[11px] font-semibold uppercase tracking-wide text-neutral-400 dark:border-zinc-800 dark:bg-zinc-900/50">
                  <tr>
                    <th className="px-4 py-3">Data</th>
                    <th className="px-4 py-3">Produto</th>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-zinc-800">
                  {sales.map((s) => {
                    const prod = products.find((p) => p.id === s.productId);
                    return (
                      <tr key={s.id}>
                        <td className="whitespace-nowrap px-4 py-3 text-neutral-500">
                          {new Date(s.createdAt).toLocaleString("pt-BR", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="max-w-[10rem] truncate px-4 py-3 font-medium text-[#1f1f1f] dark:text-zinc-100">
                          {prod?.title || "—"}
                        </td>
                        <td className="px-4 py-3 text-neutral-600 dark:text-zinc-400">
                          <span className="block truncate">{s.buyerName}</span>
                          <span className="block truncate text-[11px] text-neutral-400">
                            {s.buyerEmail}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-neutral-500">
                          {NP_SALE_STATUS_LABEL[s.status]}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums">
                          {formatPayBRL(s.amount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
