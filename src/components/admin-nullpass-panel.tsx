"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  NULLPASS_CATEGORIES,
  NULLPASS_COVER_RECOMMENDED,
  NULLPASS_GRADIENTS,
  compareNullpassProducts,
  formatNullpassPrice,
  monogramFromTitle,
  type NullpassBadge,
  type NullpassProduct,
  type NullpassProductKind,
} from "@/lib/nullpass-catalog";
import {
  compressImageDataUrl,
  fileToDataUrl,
  validateImageFile,
} from "@/lib/image";
import { apiUploadNullpassCover } from "@/lib/nullpass/client";
import { useNullpassStore, type NullpassUpsertInput } from "@/lib/nullpass-store";
import { cn } from "@/lib/utils";
import {
  Eye,
  EyeSlash,
  Image as ImageIcon,
  Package,
  PencilSimple,
  Plus,
  PushPin,
  PushPinSlash,
  Stack,
  Trash,
  Vault,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  adminId: string;
  adminName: string;
  onToast: (msg: string) => void;
};

const BADGES: { value: NullpassBadge; label: string }[] = [
  { value: null, label: "Sem badge" },
  { value: "novo", label: "Novo" },
  { value: "custo-membro", label: "Custo membro" },
  { value: "limitado", label: "Vagas limitadas" },
];

function productToInput(
  p: NullpassProduct,
  overrides?: Partial<NullpassUpsertInput>
): NullpassUpsertInput {
  return {
    title: p.title,
    tagline: p.tagline,
    category: p.category,
    badge: p.badge ?? null,
    kind: p.kind || "single",
    bundleIds: p.bundleIds || [],
    orderBumpIds: p.orderBumpIds || [],
    isOrderBump: !!p.isOrderBump,
    posterGradient: p.posterGradient,
    coverUrl: p.coverUrl,
    monogram: p.monogram,
    description: p.description,
    price: p.price ?? null,
    promoPrice: p.promoPrice ?? null,
    promoActive: !!p.promoActive,
    priceLabel: p.priceLabel,
    priceHint: p.priceHint,
    features: p.features,
    vipFulfillmentNote: p.vipFulfillmentNote,
    active: p.active !== false,
    sortOrder: p.sortOrder,
    isPinned: !!p.isPinned,
    ...overrides,
  };
}

/**
 * CRUD NullPass — só no Painel ADM.
 */
export function AdminNullpassPanel({ onToast }: Props) {
  const loadAdmin = useNullpassStore((s) => s.loadAdmin);
  const rawProducts = useNullpassStore((s) => s.products);
  const createProduct = useNullpassStore((s) => s.createProduct);
  const updateProduct = useNullpassStore((s) => s.updateProduct);
  const deleteProduct = useNullpassStore((s) => s.deleteProduct);
  const resetToSeed = useNullpassStore((s) => s.resetToSeed);
  const source = useNullpassStore((s) => s.source);
  const lastError = useNullpassStore((s) => s.lastError);
  const hasHydrated = useNullpassStore((s) => s.hasHydrated);

  const products = useMemo(
    () => [...rawProducts].sort(compareNullpassProducts),
    [rawProducts]
  );

  const [formMode, setFormMode] = useState<"new" | string | null>(null);
  const [title, setTitle] = useState("");
  const [tagline, setTagline] = useState("");
  const [category, setCategory] = useState<string>(NULLPASS_CATEGORIES[0]);
  const [badge, setBadge] = useState<NullpassBadge>(null);
  const [kind, setKind] = useState<NullpassProductKind>("single");
  const [bundleIds, setBundleIds] = useState<string[]>([]);
  const [orderBumpIds, setOrderBumpIds] = useState<string[]>([]);
  const [isOrderBump, setIsOrderBump] = useState(false);
  const [posterGradient, setPosterGradient] = useState<string>(
    NULLPASS_GRADIENTS[0]
  );
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [monogram, setMonogram] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [promoPrice, setPromoPrice] = useState("");
  const [promoActive, setPromoActive] = useState(false);
  const [priceLabel, setPriceLabel] = useState("Custo membro");
  const [priceHint, setPriceHint] = useState("");
  const [featuresText, setFeaturesText] = useState("");
  const [fulfillment, setFulfillment] = useState("");
  const [active, setActive] = useState(true);
  const [sortOrder, setSortOrder] = useState("100");
  const [isPinned, setIsPinned] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const isEditing = !!formMode && formMode !== "new";
  const showForm = formMode !== null;
  const editingId = isEditing ? formMode : null;

  /** Outros produtos (não o que está em edição) */
  const otherProducts = useMemo(
    () => products.filter((p) => p.id !== editingId),
    [products, editingId]
  );
  const bumpCandidates = useMemo(
    () => otherProducts.filter((p) => p.isOrderBump || p.kind !== "combo"),
    [otherProducts]
  );

  useEffect(() => {
    void loadAdmin();
  }, [loadAdmin]);

  function resetFormFields() {
    setTitle("");
    setTagline("");
    setCategory(NULLPASS_CATEGORIES[0]);
    setBadge(null);
    setKind("single");
    setBundleIds([]);
    setOrderBumpIds([]);
    setIsOrderBump(false);
    setPosterGradient(
      NULLPASS_GRADIENTS[
        Math.floor(Math.random() * NULLPASS_GRADIENTS.length)
      ]
    );
    setCoverUrl(null);
    setMonogram("");
    setDescription("");
    setPrice("");
    setPromoPrice("");
    setPromoActive(false);
    setPriceLabel("Custo membro");
    setPriceHint("");
    setFeaturesText("");
    setFulfillment(
      "Solicite no DM do staff com o nome do benefício. Liberação gerenciada — não compartilhe senhas em canais públicos."
    );
    setActive(true);
    setSortOrder("100");
    setIsPinned(false);
    setError("");
    setSaving(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  function closeForm() {
    resetFormFields();
    setFormMode(null);
  }

  function openCreate() {
    resetFormFields();
    setFormMode("new");
    window.requestAnimationFrame(() => {
      document
        .getElementById("admin-nullpass-form")
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  function openEdit(p: NullpassProduct) {
    setTitle(p.title);
    setTagline(p.tagline || "");
    setCategory(p.category || NULLPASS_CATEGORIES[0]);
    setBadge(p.badge ?? null);
    setKind(p.kind === "combo" ? "combo" : "single");
    setBundleIds(p.bundleIds || []);
    setOrderBumpIds(p.orderBumpIds || []);
    setIsOrderBump(!!p.isOrderBump);
    setPosterGradient(p.posterGradient || NULLPASS_GRADIENTS[0]);
    setCoverUrl(p.coverUrl || null);
    setMonogram(p.monogram || "");
    setDescription(p.description || "");
    setPrice(
      typeof p.price === "number" && Number.isFinite(p.price)
        ? String(p.price)
        : ""
    );
    setPromoPrice(
      typeof p.promoPrice === "number" && Number.isFinite(p.promoPrice)
        ? String(p.promoPrice)
        : ""
    );
    setPromoActive(!!p.promoActive);
    setPriceLabel(p.priceLabel || "Custo membro");
    setPriceHint(p.priceHint || "");
    setFeaturesText((p.features || []).join("\n"));
    setFulfillment(p.vipFulfillmentNote || "");
    setActive(p.active !== false);
    setSortOrder(String(p.sortOrder ?? 100));
    setIsPinned(!!p.isPinned);
    setError("");
    setSaving(false);
    setFormMode(p.id);
    window.requestAnimationFrame(() => {
      document
        .getElementById("admin-nullpass-form")
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  async function onPickCover(file: File | null) {
    if (!file) return;
    const v = validateImageFile(file);
    if (!v.ok) {
      setError(v.error);
      return;
    }
    setCoverBusy(true);
    setError("");
    try {
      // Comprime no browser → Blob → R2 (sem data URL no D1)
      const raw = await fileToDataUrl(file);
      const compressed = await compressImageDataUrl(raw, "post");
      const blob = await (await fetch(compressed)).blob();
      const ext =
        blob.type.includes("png")
          ? "png"
          : blob.type.includes("webp")
            ? "webp"
            : "jpg";
      const up = await apiUploadNullpassCover(blob, `cover.${ext}`);
      if (!up.ok || !up.publicUrl) {
        setError(
          up.error ||
            "Falha no upload R2. Confirme o bucket e tente de novo."
        );
        return;
      }
      setCoverUrl(up.publicUrl);
    } catch {
      setError("Falha ao processar/enviar a capa. Tente outra imagem.");
    } finally {
      setCoverBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function parseMoney(raw: string): number | null {
    if (!raw.trim()) return null;
    const n = Number(raw.replace(",", "."));
    return Number.isFinite(n) ? n : NaN;
  }

  function buildPayload(): NullpassUpsertInput {
    return {
      title,
      tagline,
      category,
      badge,
      kind,
      bundleIds: kind === "combo" ? bundleIds : [],
      orderBumpIds,
      isOrderBump: kind === "combo" ? false : isOrderBump,
      posterGradient,
      coverUrl,
      monogram: monogram.trim() || monogramFromTitle(title),
      description,
      price: parseMoney(price),
      promoPrice: parseMoney(promoPrice),
      promoActive,
      priceLabel: priceLabel.trim() || "Custo membro",
      priceHint: priceHint.trim() || undefined,
      features: featuresText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean),
      vipFulfillmentNote: fulfillment,
      active,
      sortOrder: Number(sortOrder) || 100,
      isPinned,
    };
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const payload = buildPayload();
      if (
        payload.price != null &&
        Number.isNaN(payload.price)
      ) {
        setError("Preço inválido.");
        return;
      }
      if (
        payload.promoPrice != null &&
        Number.isNaN(payload.promoPrice)
      ) {
        setError("Preço promocional inválido.");
        return;
      }
      if (isEditing && formMode) {
        const res = await updateProduct(formMode, payload);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        onToast(`NullPass “${res.product.title}” atualizado.`);
        closeForm();
        return;
      }
      const res = await createProduct(payload);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onToast(`NullPass “${res.product.title}” publicado.`);
      closeForm();
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(p: NullpassProduct) {
    if (
      !window.confirm(
        `Remover “${p.title}” do NullPass? A vitrine pública deixa de exibir.`
      )
    ) {
      return;
    }
    const res = await deleteProduct(p.id);
    if (!res.ok) {
      onToast(res.error);
      return;
    }
    if (formMode === p.id) closeForm();
    onToast(`“${p.title}” removido.`);
  }

  async function onToggleActive(p: NullpassProduct) {
    const res = await updateProduct(
      p.id,
      productToInput(p, { active: p.active === false })
    );
    if (!res.ok) {
      onToast(res.error);
      return;
    }
    onToast(
      res.product.active !== false
        ? `“${p.title}” visível na vitrine.`
        : `“${p.title}” oculto da vitrine.`
    );
  }

  async function onTogglePinned(p: NullpassProduct) {
    const next = !p.isPinned;
    const res = await updateProduct(
      p.id,
      productToInput(p, { isPinned: next })
    );
    if (!res.ok) {
      onToast(res.error);
      return;
    }
    onToast(
      next
        ? `“${p.title}” fixado em Destaque.`
        : `“${p.title}” removido do Destaque.`
    );
  }

  function toggleId(
    list: string[],
    id: string,
    setList: (v: string[]) => void
  ) {
    if (list.includes(id)) setList(list.filter((x) => x !== id));
    else setList([...list, id]);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200/90 bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-[#1f1f1f]">
            <Vault size={18} weight="fill" />
            NullPass · catálogo
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-neutral-500">
            Abasteça a vitrine VIP: capa, preços, combos, order bumps e
            promoção. Pagamentos via{" "}
            <strong className="font-medium">Nullysh Pay</strong> (Asaas).
            Fonte:{" "}
            <strong className="font-medium text-[#1f1f1f]">
              {source === "d1"
                ? "D1 (produção, multi-dispositivo)"
                : source === "local"
                  ? "local (fallback dev)"
                  : "carregando…"}
            </strong>
          </p>
          {lastError && source !== "d1" && (
            <p className="mt-1 text-[12px] text-amber-700" role="status">
              {lastError}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              if (
                !window.confirm(
                  source === "d1"
                    ? "Restaurar catálogo seed no servidor D1? Todos os produtos atuais serão substituídos."
                    : "Restaurar catálogo seed padrão? Produtos atuais serão substituídos neste navegador."
                )
              ) {
                return;
              }
              void (async () => {
                const res = await resetToSeed();
                if (!res.ok) {
                  onToast(res.error);
                  return;
                }
                onToast("Catálogo seed restaurado.");
                closeForm();
              })();
            }}
          >
            Restaurar seed
          </Button>
          <Button type="button" size="sm" onClick={openCreate}>
            <Plus size={16} weight="bold" />
            Novo produto
          </Button>
        </div>
      </div>

      {showForm && (
        <form
          id="admin-nullpass-form"
          onSubmit={onSubmit}
          className="space-y-4 rounded-2xl border border-neutral-200/90 bg-white p-4 shadow-[0_1px_2px_rgb(0_0_0/0.04)] sm:p-5"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-[#1f1f1f]">
              {isEditing ? "Editar produto" : "Novo produto"}
            </h3>
            <button
              type="button"
              onClick={closeForm}
              className="text-[13px] font-medium text-neutral-500 hover:text-[#1f1f1f]"
            >
              Cancelar
            </button>
          </div>

          {/* Tipo: single / combo */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setKind("single")}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold ring-1 transition",
                kind === "single"
                  ? "bg-[#1f1f1f] text-white ring-[#1f1f1f]"
                  : "bg-white text-neutral-600 ring-neutral-200 hover:text-[#1f1f1f]"
              )}
            >
              <Package size={14} weight="bold" />
              Produto único
            </button>
            <button
              type="button"
              onClick={() => {
                setKind("combo");
                setIsOrderBump(false);
              }}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold ring-1 transition",
                kind === "combo"
                  ? "bg-[#1f1f1f] text-white ring-[#1f1f1f]"
                  : "bg-white text-neutral-600 ring-neutral-200 hover:text-[#1f1f1f]"
              )}
            >
              <Stack size={14} weight="bold" />
              Combo
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Título"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Canva Pro"
              required
            />
            <Input
              label="Subtítulo / tagline"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="Ex.: 30 DIAS · ou frase de destaque"
            />
          </div>

          <Textarea
            label="Descrição"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="O que o membro recebe, em linguagem de benefício do clube…"
            className="min-h-[96px]"
            required
          />

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block space-y-1.5">
              <span className="text-[12px] font-medium text-neutral-600">
                Categoria
              </span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="h-10 w-full rounded-[var(--radius-md)] border border-neutral-200 bg-white px-3 text-[14px] outline-none focus:border-[#1f1f1f]"
              >
                {NULLPASS_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                {!NULLPASS_CATEGORIES.includes(
                  category as (typeof NULLPASS_CATEGORIES)[number]
                ) && <option value={category}>{category}</option>}
              </select>
            </label>
            <label className="block space-y-1.5">
              <span className="text-[12px] font-medium text-neutral-600">
                Badge
              </span>
              <select
                value={badge ?? ""}
                onChange={(e) =>
                  setBadge((e.target.value || null) as NullpassBadge)
                }
                className="h-10 w-full rounded-[var(--radius-md)] border border-neutral-200 bg-white px-3 text-[14px] outline-none focus:border-[#1f1f1f]"
              >
                {BADGES.map((b) => (
                  <option key={String(b.value)} value={b.value ?? ""}>
                    {b.label}
                  </option>
                ))}
              </select>
            </label>
            <Input
              label="Ordem (menor = primeiro)"
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50/80 px-3 py-2.5 text-[13px] font-medium text-neutral-700">
            <input
              type="checkbox"
              checked={isPinned}
              onChange={(e) => setIsPinned(e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300"
            />
            <PushPin size={16} weight={isPinned ? "fill" : "regular"} />
            Fixar no Destaque (row “Em destaque”, máx. 6)
          </label>

          {/* Preços */}
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50/80 p-3 sm:p-4">
            <p className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-neutral-500">
              Preços · Nullysh Pay
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Input
                label="Preço cheio (R$)"
                type="text"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="Ex.: 29.90"
              />
              <Input
                label="Preço promocional (R$)"
                type="text"
                inputMode="decimal"
                value={promoPrice}
                onChange={(e) => setPromoPrice(e.target.value)}
                placeholder="Ex.: 9.99"
              />
              <label className="flex items-end gap-2 pb-1 text-[13px] font-medium text-neutral-700">
                <input
                  type="checkbox"
                  checked={promoActive}
                  onChange={(e) => setPromoActive(e.target.checked)}
                  className="h-4 w-4 rounded border-neutral-300"
                />
                Ativar promoção
              </label>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Input
                label="Rótulo do preço"
                value={priceLabel}
                onChange={(e) => setPriceLabel(e.target.value)}
                placeholder="Custo membro"
              />
              <Input
                label="Dica de preço"
                value={priceHint}
                onChange={(e) => setPriceHint(e.target.value)}
                placeholder="Opcional · ex.: 30 dias"
              />
            </div>
            <p className="mt-2 text-[11px] text-neutral-400">
              Com promoção ativa, a vitrine mostra o preço promo e o cheio
              riscado. Checkout futuro via Nullysh Pay (Asaas).
            </p>
          </div>

          {/* Combo items */}
          {kind === "combo" && (
            <div className="rounded-2xl border border-neutral-200 bg-white p-3 sm:p-4">
              <p className="mb-1 text-[12px] font-semibold text-[#1f1f1f]">
                Itens do combo
              </p>
              <p className="mb-3 text-[11px] text-neutral-500">
                Selecione ao menos 2 produtos inclusos neste pacote.
              </p>
              {otherProducts.length === 0 ? (
                <p className="text-[13px] text-neutral-400">
                  Cadastre produtos únicos antes de montar o combo.
                </p>
              ) : (
                <ul className="max-h-48 space-y-1.5 overflow-y-auto thin-scroll">
                  {otherProducts.map((p) => (
                    <li key={p.id}>
                      <label className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-1.5 text-[13px] hover:bg-neutral-50">
                        <input
                          type="checkbox"
                          checked={bundleIds.includes(p.id)}
                          onChange={() =>
                            toggleId(bundleIds, p.id, setBundleIds)
                          }
                          className="h-4 w-4 rounded border-neutral-300"
                        />
                        <span className="min-w-0 flex-1 truncate font-medium text-[#1f1f1f]">
                          {p.title}
                        </span>
                        <span className="shrink-0 text-[11px] text-neutral-400">
                          {formatNullpassPrice(p)}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Order bumps */}
          {kind === "single" && (
            <div className="rounded-2xl border border-neutral-200 bg-white p-3 sm:p-4">
              <p className="mb-1 text-[12px] font-semibold text-[#1f1f1f]">
                Order bumps neste produto
              </p>
              <p className="mb-3 text-[11px] text-neutral-500">
                Ofertas extras no checkout (Nullysh Pay). Marque produtos que
                também estejam elegíveis como bump.
              </p>
              <label className="mb-3 flex cursor-pointer items-center gap-2 text-[13px] font-medium text-neutral-700">
                <input
                  type="checkbox"
                  checked={isOrderBump}
                  onChange={(e) => setIsOrderBump(e.target.checked)}
                  className="h-4 w-4 rounded border-neutral-300"
                />
                Este produto pode ser order bump de outros
              </label>
              {bumpCandidates.length === 0 ? (
                <p className="text-[13px] text-neutral-400">
                  Nenhum outro produto disponível ainda.
                </p>
              ) : (
                <ul className="max-h-40 space-y-1.5 overflow-y-auto thin-scroll">
                  {bumpCandidates.map((p) => (
                    <li key={p.id}>
                      <label className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-1.5 text-[13px] hover:bg-neutral-50">
                        <input
                          type="checkbox"
                          checked={orderBumpIds.includes(p.id)}
                          onChange={() =>
                            toggleId(orderBumpIds, p.id, setOrderBumpIds)
                          }
                          className="h-4 w-4 rounded border-neutral-300"
                        />
                        <span className="min-w-0 flex-1 truncate">
                          {p.title}
                          {p.isOrderBump && (
                            <span className="ml-1 text-[10px] font-semibold uppercase text-amber-600">
                              bump
                            </span>
                          )}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <Input
              label="Monograma (capa)"
              value={monogram}
              onChange={(e) => setMonogram(e.target.value)}
              placeholder="Auto se vazio"
              maxLength={4}
            />
            <label className="flex h-10 cursor-pointer items-center gap-2 text-[13px] font-medium text-neutral-700">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="h-4 w-4 rounded border-neutral-300"
              />
              Visível na vitrine
            </label>
          </div>

          {/* Capa + tamanho recomendado */}
          <div className="space-y-2">
            <p className="text-[12px] font-medium text-neutral-600">
              Capa do card
            </p>
            <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-[12px] leading-relaxed text-sky-900">
              <strong className="font-semibold">Tamanho recomendado:</strong>{" "}
              {NULLPASS_COVER_RECOMMENDED.label}
              <span className="mt-0.5 block text-sky-800/80">
                {NULLPASS_COVER_RECOMMENDED.hint}
              </span>
            </div>
            <div className="flex flex-wrap items-start gap-3">
              <div
                className="relative h-[135px] w-[90px] overflow-hidden rounded-xl border border-neutral-200 shadow-sm"
                style={{
                  background: coverUrl ? undefined : posterGradient,
                }}
              >
                {coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={coverUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-white/90">
                    {monogram || monogramFromTitle(title || "?")}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) =>
                    void onPickCover(e.target.files?.[0] ?? null)
                  }
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    loading={coverBusy}
                    onClick={() => fileRef.current?.click()}
                  >
                    <ImageIcon size={16} />
                    {coverUrl ? "Trocar capa" : "Enviar capa"}
                  </Button>
                  {coverUrl && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setCoverUrl(null)}
                    >
                      Usar só gradiente
                    </Button>
                  )}
                </div>
                <p className="text-[11px] text-neutral-400">
                  JPG/PNG/WebP · upload no R2 (URL pública). Sem capa, o
                  gradiente vira o poster. Capas Base64 legadas ainda
                  funcionam na vitrine.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {NULLPASS_GRADIENTS.map((g) => (
                    <button
                      key={g}
                      type="button"
                      title="Gradiente de fallback"
                      onClick={() => setPosterGradient(g)}
                      className={cn(
                        "h-7 w-7 rounded-full border-2 transition",
                        posterGradient === g
                          ? "scale-110 border-[#1f1f1f]"
                          : "border-transparent opacity-80 hover:opacity-100"
                      )}
                      style={{ background: g }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <Textarea
            label="Destaques (um por linha)"
            value={featuresText}
            onChange={(e) => setFeaturesText(e.target.value)}
            placeholder={"Recurso 1\nRecurso 2\nRecurso 3"}
            className="min-h-[80px]"
          />

          <Textarea
            label="Instrução VIP (como liberar)"
            value={fulfillment}
            onChange={(e) => setFulfillment(e.target.value)}
            placeholder="Texto que o VIP vê no modal — sem senhas."
            className="min-h-[72px]"
          />

          {error && (
            <p className="text-[13px] font-medium text-red-600" role="alert">
              {error}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" loading={saving}>
              {isEditing ? "Salvar alterações" : "Publicar no NullPass"}
            </Button>
            <Button type="button" variant="outline" onClick={closeForm}>
              Cancelar
            </Button>
          </div>
        </form>
      )}

      {/* Lista */}
      <div className="space-y-2">
        {!hasHydrated ? (
          <div className="rounded-2xl border border-neutral-200 bg-white p-10 text-center text-sm text-neutral-400">
            Carregando catálogo…
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-center text-sm text-neutral-500">
            Nenhum produto. Clique em <strong>Novo produto</strong> ou restaure
            o seed.
          </div>
        ) : (
          products.map((p) => (
            <div
              key={p.id}
              className={cn(
                "flex flex-col gap-3 rounded-2xl border bg-white p-3 sm:flex-row sm:items-center sm:p-4",
                p.active === false
                  ? "border-dashed border-neutral-300 opacity-75"
                  : "border-neutral-200/90"
              )}
            >
              <div
                className="relative h-16 w-12 shrink-0 overflow-hidden rounded-xl border border-neutral-200"
                style={{
                  background: p.coverUrl ? undefined : p.posterGradient,
                }}
              >
                {p.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.coverUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex h-full items-center justify-center text-[11px] font-semibold text-white">
                    {p.monogram}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-[#1f1f1f]">
                    {p.title}
                  </p>
                  {p.kind === "combo" && (
                    <span className="rounded-md bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-violet-700">
                      Combo
                    </span>
                  )}
                  {p.isOrderBump && (
                    <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-800">
                      Bump
                    </span>
                  )}
                  {p.promoActive && (
                    <span className="rounded-md bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-rose-700">
                      Promo
                    </span>
                  )}
                  {p.isPinned && (
                    <span className="rounded-md bg-[#1f1f1f] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white">
                      Fixado
                    </span>
                  )}
                  {p.active === false && (
                    <span className="rounded-md bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-neutral-500">
                      Oculto
                    </span>
                  )}
                  <span className="text-[12px] font-medium text-neutral-500">
                    {formatNullpassPrice(p)}
                  </span>
                </div>
                <p className="truncate text-[12px] text-neutral-400">
                  {p.category}
                  {` · ordem ${p.sortOrder ?? 100}`}
                  {p.tagline ? ` · ${p.tagline}` : ""}
                  {(p.orderBumpIds?.length || 0) > 0
                    ? ` · ${p.orderBumpIds!.length} bump(s)`
                    : ""}
                  {p.kind === "combo" && (p.bundleIds?.length || 0) > 0
                    ? ` · ${p.bundleIds!.length} itens`
                    : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 sm:justify-end">
                <Button
                  type="button"
                  size="sm"
                  variant={p.isPinned ? "primary" : "ghost"}
                  title={
                    p.isPinned
                      ? "Remover do Destaque"
                      : "Fixar no Destaque"
                  }
                  onClick={() => onTogglePinned(p)}
                >
                  {p.isPinned ? (
                    <PushPin size={16} weight="fill" />
                  ) : (
                    <PushPinSlash size={16} weight="bold" />
                  )}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  title={p.active === false ? "Mostrar" : "Ocultar"}
                  onClick={() => onToggleActive(p)}
                >
                  {p.active === false ? (
                    <Eye size={16} weight="bold" />
                  ) : (
                    <EyeSlash size={16} weight="bold" />
                  )}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => openEdit(p)}
                >
                  <PencilSimple size={16} weight="bold" />
                  Editar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() => onDelete(p)}
                >
                  <Trash size={16} weight="bold" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
