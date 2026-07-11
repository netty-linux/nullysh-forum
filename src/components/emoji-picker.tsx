"use client";

import {
  emojiShortcode,
  normalizeEmojiName,
  useEmojiStore,
  validateEmojiImage,
} from "@/lib/emoji-store";
import { cn } from "@/lib/utils";
import {
  CrownSimple,
  Plus,
  Smiley,
  Sparkle,
  Trash,
  X,
} from "@phosphor-icons/react";
import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";

const UNICODE_GROUPS: { label: string; emojis: string[] }[] = [
  {
    label: "Frequentes",
    emojis: [
      "😀", "😂", "🥰", "😍", "😎", "🤔", "🙌", "👏", "🔥", "✨",
      "💯", "❤️", "🚀", "💪", "👀", "✅", "☕", "🌙", "💡", "🎯",
    ],
  },
  {
    label: "Rostos",
    emojis: [
      "😃", "😄", "😁", "😅", "🤣", "😊", "😇", "🙂", "😉", "🤩",
      "🥳", "😤", "🤯", "🤗", "🫡", "🤫", "🫠", "😴", "🥺", "😭",
    ],
  },
  {
    label: "Gestos",
    emojis: [
      "👍", "👎", "✌️", "🤞", "🤝", "👋", "🫶", "☝️", "👊", "🤟",
      "🤙", "🙏", "💅", "🧠", "💬", "📣", "🖤", "🤍", "⭐", "🌟",
    ],
  },
];

type Tab = "emoji" | "custom";

type Props = {
  open: boolean;
  onClose: () => void;
  onPickUnicode: (emoji: string) => void;
  onPickCustom: (shortcode: string) => void;
  isVip: boolean;
  userId?: string;
  userName?: string;
  isAdmin?: boolean;
  panelRef?: RefObject<HTMLDivElement | null>;
  className?: string;
  /**
   * `dropdown` (padrão): absolute sob o botão.
   * `inline`: no fluxo do layout (ex.: modal de postagem — evita recorte).
   */
  variant?: "dropdown" | "inline";
};

export function EmojiPicker({
  open,
  onClose,
  onPickUnicode,
  onPickCustom,
  isVip,
  userId,
  userName,
  isAdmin,
  panelRef,
  className,
  variant = "dropdown",
}: Props) {
  const emojis = useEmojiStore((s) => s.emojis);
  const createEmoji = useEmojiStore((s) => s.createEmoji);
  const deleteEmoji = useEmojiStore((s) => s.deleteEmoji);

  const [tab, setTab] = useState<Tab>("emoji");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setCreating(false);
      setFormError("");
      setPreview(null);
      setName("");
      setSaving(false);
    }
  }, [open]);

  const filteredUnicode = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return UNICODE_GROUPS;
    return UNICODE_GROUPS.map((g) => ({
      ...g,
      emojis: g.emojis.filter((e) => e.includes(q)),
    })).filter((g) => g.emojis.length > 0);
  }, [query]);

  const filteredCustom = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^:+|:+$/g, "");
    if (!q) return emojis;
    return emojis.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.createdByName.toLowerCase().includes(q)
    );
  }, [emojis, query]);

  function onFile(file: File | null) {
    if (!file) return;
    const v = validateEmojiImage(file);
    if (!v.ok) {
      setFormError(v.error);
      return;
    }
    setFormError("");
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setPreview(reader.result);
    };
    reader.readAsDataURL(file);
  }

  async function handleCreate() {
    if (!isVip || !userId || !userName) return;
    if (!preview) {
      setFormError("Envie uma imagem para o emoji.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const result = await createEmoji({
        name,
        imageUrl: preview,
        userId,
        userName,
      });
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      setCreating(false);
      setName("");
      setPreview(null);
      setFormError("");
      setTab("custom");
    } catch (e) {
      setFormError(
        e instanceof Error
          ? e.message
          : "Falha ao criar emoji. Tente uma imagem menor."
      );
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Seletor de emoji"
      className={cn(
        "overflow-hidden rounded-2xl border border-neutral-200 bg-[#0f0f12] text-white shadow-[0_16px_48px_-12px_rgb(0_0_0/0.55)] dark:border-zinc-700",
        variant === "inline"
          ? "relative z-10 w-full"
          : "absolute left-0 top-full z-50 mt-2 w-[min(100vw-2rem,320px)]",
        className
      )}
    >
      {/* Tabs estilo Discord */}
      <div className="flex items-center gap-1 border-b border-white/10 px-2 pt-2">
        <button
          type="button"
          onClick={() => {
            setTab("emoji");
            setCreating(false);
          }}
          className={cn(
            "rounded-t-lg px-3 py-2 text-xs font-semibold transition",
            tab === "emoji"
              ? "bg-white/10 text-white"
              : "text-white/50 hover:text-white/80"
          )}
        >
          <span className="inline-flex items-center gap-1">
            <Smiley size={14} />
            Emoji
          </span>
        </button>
        <button
          type="button"
          onClick={() => setTab("custom")}
          className={cn(
            "rounded-t-lg px-3 py-2 text-xs font-semibold transition",
            tab === "custom"
              ? "bg-white/10 text-white"
              : "text-white/50 hover:text-white/80"
          )}
        >
          <span className="inline-flex items-center gap-1">
            <Sparkle size={14} weight="fill" className="text-amber-300" />
            Custom
            {isVip && (
              <CrownSimple size={11} weight="fill" className="text-amber-300" />
            )}
          </span>
        </button>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto mb-1 inline-flex h-7 w-7 items-center justify-center rounded-lg text-white/50 hover:bg-white/10 hover:text-white"
          aria-label="Fechar"
        >
          <X size={14} weight="bold" />
        </button>
      </div>

      {/* Busca */}
      <div className="border-b border-white/10 px-3 py-2">
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-2.5 py-1.5">
          <span className="text-white/40">⌕</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              tab === "custom" ? "Buscar :nome:" : "Buscar emoji…"
            }
            className="composer-input h-7 flex-1 border-0 bg-transparent text-sm text-white placeholder:text-white/35 outline-none focus:outline-none focus-visible:outline-none"
          />
        </div>
      </div>

      <div className="thin-scroll max-h-64 overflow-y-auto overscroll-contain p-2">
        {tab === "emoji" && (
          <div className="space-y-2">
            {filteredUnicode.length === 0 && (
              <p className="px-2 py-6 text-center text-xs text-white/40">
                Nenhum emoji encontrado.
              </p>
            )}
            {filteredUnicode.map((group) => (
              <div key={group.label}>
                <p className="mb-1 px-1 text-[10px] font-bold uppercase tracking-wide text-white/40">
                  {group.label}
                </p>
                <div className="grid grid-cols-8 gap-0.5">
                  {group.emojis.map((em, i) => (
                    <button
                      key={`${group.label}-${em}-${i}`}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => onPickUnicode(em)}
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-lg leading-none transition hover:bg-white/10 active:scale-95"
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "custom" && (
          <div className="space-y-3">
            {!isVip && (
              <div className="rounded-xl border border-amber-400/25 bg-amber-400/10 p-3 text-center">
                <p className="text-xs font-semibold text-amber-100">
                  Emojis customizados são exclusivos VIP
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-amber-100/70">
                  Como o Nitro no Discord: só VIP cria e usa emojis
                  personalizados no feed.
                </p>
                <Link
                  href="/pricing"
                  onClick={onClose}
                  className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-black"
                >
                  <CrownSimple size={12} weight="fill" />
                  Obter VIP
                </Link>
              </div>
            )}

            {isVip && (
              <>
                {!creating ? (
                  <button
                    type="button"
                    onClick={() => setCreating(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-white/5 py-2.5 text-xs font-semibold text-white/80 transition hover:border-white/40 hover:bg-white/10"
                  >
                    <Plus size={14} weight="bold" />
                    Criar emoji custom
                  </button>
                ) : (
                  <div className="space-y-2 rounded-xl border border-white/10 bg-black/30 p-3">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-white/45">
                      Novo emoji VIP
                    </p>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/15 bg-white/5 hover:bg-white/10"
                      >
                        {preview ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={preview}
                            alt=""
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <Plus size={18} className="text-white/50" />
                        )}
                      </button>
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/png,image/jpeg,image/gif,image/webp"
                        className="hidden"
                        onChange={(e) =>
                          onFile(e.target.files?.[0] ?? null)
                        }
                      />
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-black/40 px-2">
                          <span className="text-sm text-white/40">:</span>
                          <input
                            value={name}
                            onChange={(e) =>
                              setName(normalizeEmojiName(e.target.value))
                            }
                            placeholder="NomeDoEmoji"
                            maxLength={32}
                            className="composer-input h-9 flex-1 border-0 bg-transparent text-sm text-white placeholder:text-white/30 outline-none focus:outline-none focus-visible:outline-none"
                          />
                          <span className="text-sm text-white/40">:</span>
                        </div>
                        <p className="text-[10px] text-white/35">
                          PNG/GIF/WebP · máx. 3 MB · comprimido e salvo no
                          Storage (não no localStorage)
                        </p>
                      </div>
                    </div>
                    {formError && (
                      <p className="text-[11px] font-medium text-red-400">
                        {formError}
                      </p>
                    )}
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setCreating(false);
                          setFormError("");
                          setPreview(null);
                          setName("");
                        }}
                        className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-white/60 hover:bg-white/10"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleCreate}
                        disabled={saving}
                        className="rounded-lg bg-white px-3 py-1.5 text-[11px] font-bold text-black disabled:opacity-50"
                      >
                        {saving ? "Salvando…" : "Criar"}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {isVip && (
              <>
                <p className="px-1 text-[10px] font-bold uppercase tracking-wide text-white/40">
                  Nullysh custom · {filteredCustom.length}
                </p>
                {filteredCustom.length === 0 ? (
                  <p className="px-2 py-4 text-center text-xs text-white/40">
                    {emojis.length === 0
                      ? "Nenhum emoji custom ainda. Crie o primeiro!"
                      : "Nenhum resultado para essa busca."}
                  </p>
                ) : (
                  <div className="grid grid-cols-6 gap-1">
                    {filteredCustom.map((e) => {
                      const canDelete =
                        isAdmin || e.createdById === userId;
                      return (
                        <div key={e.id} className="group relative">
                          <button
                            type="button"
                            title={`:${e.name}: · ${e.createdByName}`}
                            onMouseDown={(ev) => ev.preventDefault()}
                            onClick={() =>
                              onPickCustom(emojiShortcode(e.name))
                            }
                            className="flex h-11 w-full flex-col items-center justify-center rounded-lg p-1 transition hover:bg-white/10"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={e.imageUrl}
                              alt={e.name}
                              className="h-7 w-7 object-contain"
                            />
                          </button>
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => {
                                void deleteEmoji(
                                  e.id,
                                  userId || "",
                                  !!isAdmin
                                );
                              }}
                              className="absolute -right-0.5 -top-0.5 hidden h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white group-hover:inline-flex"
                              aria-label={`Remover :${e.name}:`}
                              title="Remover"
                            >
                              <Trash size={10} weight="bold" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* Free pode ver preview se existirem? só VIP usa — se free e há emojis, mostrar lock grid opcional */}
            {!isVip && emojis.length > 0 && (
              <div>
                <p className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-wide text-white/35">
                  Prévia VIP
                </p>
                <div className="grid grid-cols-6 gap-1 opacity-40">
                  {emojis.slice(0, 12).map((e) => (
                    <div
                      key={e.id}
                      className="flex h-11 items-center justify-center rounded-lg bg-white/5"
                      title="VIP only"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={e.imageUrl}
                        alt=""
                        className="h-7 w-7 object-contain grayscale"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
