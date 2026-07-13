"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  NULLPASS_CATEGORIES,
  NULLPASS_GRADIENTS,
  formatNullpassPrice,
  monogramFromTitle,
  type NullpassBadge,
  type NullpassProduct,
} from "@/lib/nullpass-catalog";
import { useNullpassStore } from "@/lib/nullpass-store";
import {
  compressImageDataUrl,
  fileToDataUrl,
  validateImageFile,
} from "@/lib/image";
import { cn } from "@/lib/utils";
import {
  Eye,
  EyeSlash,
  Image as ImageIcon,
  PencilSimple,
  Plus,
  Trash,
  Vault,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

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

/**
 * CRUD NullPass — só no Painel ADM.
 */
export function AdminNullpassPanel({ onToast }: Props) {
  const ensureSeed = useNullpassStore((s) => s.ensureSeed);
  const rawProducts = useNullpassStore((s) => s.products);
  const createProduct = useNullpassStore((s) => s.createProduct);
  const updateProduct = useNullpassStore((s) => s.updateProduct);
  const deleteProduct = useNullpassStore((s) => s.deleteProduct);
  const resetToSeed = useNullpassStore((s) => s.resetToSeed);

  const products = [...rawProducts].sort(
    (a, b) =>
      (a.sortOrder ?? 100) - (b.sortOrder ?? 100) ||
      a.title.localeCompare(b.title, "pt-BR")
  );

  const [formMode, setFormMode] = useState<"new" | string | null>(null);
  const [title, setTitle] = useState("");
  const [tagline, setTagline] = useState("");
  const [category, setCategory] = useState<string>(NULLPASS_CATEGORIES[0]);
  const [badge, setBadge] = useState<NullpassBadge>(null);
  const [posterGradient, setPosterGradient] = useState<string>(
    NULLPASS_GRADIENTS[0]
  );
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [monogram, setMonogram] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [priceLabel, setPriceLabel] = useState("Custo membro");
  const [priceHint, setPriceHint] = useState("");
  const [featuresText, setFeaturesText] = useState("");
  const [fulfillment, setFulfillment] = useState("");
  const [active, setActive] = useState(true);
  const [sortOrder, setSortOrder] = useState("100");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const isEditing = !!formMode && formMode !== "new";
  const showForm = formMode !== null;

  useEffect(() => {
    ensureSeed();
  }, [ensureSeed]);

  function resetFormFields() {
    setTitle("");
    setTagline("");
    setCategory(NULLPASS_CATEGORIES[0]);
    setBadge(null);
    setPosterGradient(
      NULLPASS_GRADIENTS[
        Math.floor(Math.random() * NULLPASS_GRADIENTS.length)
      ]
    );
    setCoverUrl(null);
    setMonogram("");
    setDescription("");
    setPrice("");
    setPriceLabel("Custo membro");
    setPriceHint("");
    setFeaturesText("");
    setFulfillment(
      "Solicite no DM do staff com o nome do benefício. Liberação gerenciada — não compartilhe senhas em canais públicos."
    );
    setActive(true);
    setSortOrder("100");
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
    setPosterGradient(p.posterGradient || NULLPASS_GRADIENTS[0]);
    setCoverUrl(p.coverUrl || null);
    setMonogram(p.monogram || "");
    setDescription(p.description || "");
    setPrice(
      typeof p.price === "number" && Number.isFinite(p.price)
        ? String(p.price)
        : ""
    );
    setPriceLabel(p.priceLabel || "Custo membro");
    setPriceHint(p.priceHint || "");
    setFeaturesText((p.features || []).join("\n"));
    setFulfillment(p.vipFulfillmentNote || "");
    setActive(p.active !== false);
    setSortOrder(String(p.sortOrder ?? 100));
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
      const raw = await fileToDataUrl(file);
      const compressed = await compressImageDataUrl(raw, "post");
      setCoverUrl(compressed);
    } catch {
      setError("Falha ao processar a capa. Tente outra imagem.");
    } finally {
      setCoverBusy(false);
    }
  }

  function buildPayload() {
    const priceNum = price.trim()
      ? Number(price.replace(",", "."))
      : null;
    return {
      title,
      tagline,
      category,
      badge,
      posterGradient,
      coverUrl,
      monogram: monogram.trim() || monogramFromTitle(title),
      description,
      price: priceNum,
      priceLabel: priceLabel.trim() || "Custo membro",
      priceHint: priceHint.trim() || undefined,
      features: featuresText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean),
      vipFulfillmentNote: fulfillment,
      active,
      sortOrder: Number(sortOrder) || 100,
    };
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const payload = buildPayload();
      if (isEditing && formMode) {
        const res = updateProduct(formMode, payload);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        onToast(`NullPass “${res.product.title}” atualizado.`);
        closeForm();
        return;
      }
      const res = createProduct(payload);
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

  function onDelete(p: NullpassProduct) {
    if (
      !window.confirm(
        `Remover “${p.title}” do NullPass? A vitrine pública deixa de exibir.`
      )
    ) {
      return;
    }
    const res = deleteProduct(p.id);
    if (!res.ok) {
      onToast(res.error);
      return;
    }
    if (formMode === p.id) closeForm();
    onToast(`“${p.title}” removido.`);
  }

  function onToggleActive(p: NullpassProduct) {
    const res = updateProduct(p.id, {
      title: p.title,
      tagline: p.tagline,
      category: p.category,
      badge: p.badge ?? null,
      posterGradient: p.posterGradient,
      coverUrl: p.coverUrl,
      monogram: p.monogram,
      description: p.description,
      price: p.price ?? null,
      priceLabel: p.priceLabel,
      priceHint: p.priceHint,
      features: p.features,
      vipFulfillmentNote: p.vipFulfillmentNote,
      active: p.active === false,
      sortOrder: p.sortOrder,
    });
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

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200/90 bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-[#1f1f1f]">
            <Vault size={18} weight="fill" />
            NullPass · catálogo
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-neutral-500">
            Abasteça a vitrine VIP: capa, título, descrição, preço e texto de
            liberação. Só o que estiver <strong className="font-medium">ativo</strong>{" "}
            aparece em /app/nullpass.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              if (
                window.confirm(
                  "Restaurar catálogo seed padrão? Produtos atuais serão substituídos neste navegador."
                )
              ) {
                resetToSeed();
                onToast("Catálogo seed restaurado.");
                closeForm();
              }
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
              placeholder="Uma linha de destaque"
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
                  setBadge(
                    (e.target.value || null) as NullpassBadge
                  )
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

          <div className="grid gap-3 sm:grid-cols-3">
            <Input
              label="Preço (R$)"
              type="text"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Ex.: 19.90 — vazio = só rótulo"
            />
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
              placeholder="Opcional"
            />
          </div>

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

          {/* Capa */}
          <div className="space-y-2">
            <p className="text-[12px] font-medium text-neutral-600">
              Capa do card
            </p>
            <div className="flex flex-wrap items-start gap-3">
              <div
                className="relative h-28 w-20 overflow-hidden rounded-xl border border-neutral-200 shadow-sm"
                style={{
                  background: coverUrl
                    ? undefined
                    : posterGradient,
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
                  JPG/PNG/WebP. Sem capa, o gradiente vira o poster.
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
                          ? "border-[#1f1f1f] scale-110"
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
        {products.length === 0 ? (
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
                  {p.tagline ? ` · ${p.tagline}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 sm:justify-end">
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
