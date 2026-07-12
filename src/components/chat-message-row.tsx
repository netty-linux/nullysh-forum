"use client";

import { ChatMediaBubble } from "@/components/chat-media-bubble";
import {
  ChatMessageTicks,
  deliveryStatusOf,
} from "@/components/chat-message-ticks";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ProfileHoverCard } from "@/components/profile-hover-card";
import { SharedPostEmbed } from "@/components/shared-post-embed";
import { Avatar } from "@/components/ui/avatar";
import { VerifiedBadge } from "@/components/verified-badge";
import type { ChatMessage, Post } from "@/lib/types";
import { cn, formatRelative } from "@/lib/utils";
import { DotsThree, Smiley, Trash } from "@phosphor-icons/react";
import Link from "next/link";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import { createPortal } from "react-dom";

/** Reações rápidas estilo Instagram */
export const DM_QUICK_REACTIONS = ["❤️", "😂", "😮", "😢", "😡", "👍"] as const;

type UserLite = {
  id: string;
  avatarUrl?: string | null;
  isVip?: boolean;
  avatarFrame?: string | null;
  isVerified?: boolean;
};

type Props = {
  message: ChatMessage;
  mine: boolean;
  isDm: boolean;
  canDelete: boolean;
  users: UserLite[];
  posts: Post[];
  currentUserId: string | null;
  onDelete: (messageId: string) => void;
  onReact: (messageId: string, emoji: string) => void;
};

/**
 * Linha de mensagem do bate-papo:
 * - 3 pontinhos laterais (meio vertical) estilo Instagram
 * - reações flutuantes no hover
 * - modal Nullysh para apagar
 */
export function ChatMessageRow({
  message: m,
  mine,
  isDm,
  canDelete,
  users,
  posts,
  currentUserId,
  onDelete,
  onReact,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [reactOpen, setReactOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [heartPop, setHeartPop] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const [reactPos, setReactPos] = useState({ top: 0, left: 0 });
  const dotsRef = useRef<HTMLButtonElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);
  const reactPanelRef = useRef<HTMLDivElement>(null);

  function handleDoubleLike(e: MouseEvent) {
    e.preventDefault();
    if (!currentUserId) return;
    // Duplo clique = Amei (❤️) — só adiciona (não remove no 2º double-tap)
    const alreadyLoved = (m.reactions?.["❤️"] || []).includes(currentUserId);
    if (!alreadyLoved) {
      onReact(m.id, "❤️");
    }
    setHeartPop(true);
    window.setTimeout(() => setHeartPop(false), 700);
  }

  // Posiciona menus em fixed (portal) — evita corte por overflow do scroll
  useLayoutEffect(() => {
    if (!menuOpen && !reactOpen) return;
    function place() {
      const btn = dotsRef.current;
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      const gap = 8;

      if (menuOpen) {
        const mw = 168;
        const mh = menuPanelRef.current?.offsetHeight || 88;
        let left = mine ? r.left - mw - gap : r.right + gap;
        let top = r.bottom - mh;
        // clamp viewport
        left = Math.min(Math.max(8, left), window.innerWidth - mw - 8);
        top = Math.min(Math.max(8, top), window.innerHeight - mh - 8);
        setMenuPos({ top, left });
      }

      if (reactOpen) {
        const rw = reactPanelRef.current?.offsetWidth || 240;
        const rh = reactPanelRef.current?.offsetHeight || 44;
        let left = r.left + r.width / 2 - rw / 2;
        let top = r.top - rh - gap;
        if (top < 8) top = r.bottom + gap;
        left = Math.min(Math.max(8, left), window.innerWidth - rw - 8);
        setReactPos({ top, left });
      }
    }
    place();
    const id = requestAnimationFrame(place);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [menuOpen, reactOpen, mine]);

  useEffect(() => {
    if (!menuOpen && !reactOpen) return;
    function onDoc(e: globalThis.MouseEvent) {
      const t = e.target as Node;
      if (dotsRef.current?.contains(t)) return;
      if (menuPanelRef.current?.contains(t)) return;
      if (reactPanelRef.current?.contains(t)) return;
      setMenuOpen(false);
      setReactOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen, reactOpen]);

  const author = users.find((u) => u.id === m.authorId);
  const reactions = m.reactions || {};
  const reactionEntries = Object.entries(reactions).filter(
    ([, ids]) => ids.length > 0
  );
  const myReaction = currentUserId
    ? Object.entries(reactions).find(([, ids]) =>
        ids.includes(currentUserId)
      )?.[0]
    : undefined;

  // Conteúdo de texto limpo
  let note = m.content.trim();
  if (m.sharedPostId && note) {
    const cut = note.indexOf("📤");
    if (cut >= 0) note = note.slice(0, cut).trim();
    if (!note || /^Post de\b/i.test(note) || /^[“"]/.test(note)) note = "";
  }
  if (m.mediaKind === "sticker") note = "";
  // GIF: nunca mostra título/caption (só a mídia)
  if (m.mediaKind === "gif") note = "";
  if (
    m.mediaKind === "image" ||
    m.mediaKind === "video" ||
    m.mediaKind === "audio"
  ) {
    if (!m.content.trim()) note = "";
  }
  const shared = m.sharedPostId
    ? posts.find((p) => p.id === m.sharedPostId)
    : null;
  const hasMedia =
    m.mediaKind &&
    m.mediaKind !== "text" &&
    (m.mediaUrl || m.mediaKind === "sticker");

  const sideActions = (
    <div
      className={cn(
        // sticky no meio da bolha: alinha com o topo do conteúdo + offset
        "relative mt-6 flex shrink-0 items-center justify-center self-start",
        "opacity-0 transition-opacity duration-150",
        "group-hover/msg:opacity-100 focus-within:opacity-100",
        (menuOpen || reactOpen) && "opacity-100"
      )}
    >
      <button
        ref={dotsRef}
        type="button"
        title="Mais opções"
        aria-label="Mais opções da mensagem"
        aria-expanded={menuOpen || reactOpen}
        onClick={() => {
          if (reactOpen) {
            setReactOpen(false);
            return;
          }
          setMenuOpen((v) => !v);
        }}
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center rounded-full",
          "text-neutral-400 transition hover:bg-neutral-100 hover:text-[#1f1f1f]",
          "dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
          (menuOpen || reactOpen) &&
            "bg-neutral-100 text-[#1f1f1f] dark:bg-zinc-800"
        )}
      >
        <DotsThree size={20} weight="bold" />
      </button>

      {/* Portal: fora do overflow-y do chat */}
      {typeof document !== "undefined" &&
        menuOpen &&
        createPortal(
          <div
            ref={menuPanelRef}
            className={cn(
              "fixed z-[120] min-w-[10.5rem] overflow-hidden rounded-xl border border-neutral-200/90 bg-white py-1",
              "shadow-[0_12px_32px_-12px_rgb(0_0_0/0.3)]",
              "dark:border-zinc-700 dark:bg-[#1a1a1a]"
            )}
            style={{ top: menuPos.top, left: menuPos.left }}
            role="menu"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                setReactOpen(true);
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] font-medium text-neutral-700 hover:bg-neutral-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <Smiley size={16} />
              Reagir
            </button>
            {canDelete && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  setConfirmDelete(true);
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
              >
                <Trash size={16} weight="bold" />
                Apagar
              </button>
            )}
          </div>,
          document.body
        )}

      {typeof document !== "undefined" &&
        reactOpen &&
        createPortal(
          <div
            ref={reactPanelRef}
            className={cn(
              "fixed z-[120] flex items-center gap-0.5 rounded-full border border-neutral-200/90 bg-white px-1.5 py-1",
              "shadow-[0_8px_28px_-8px_rgb(0_0_0/0.28)]",
              "dark:border-zinc-700 dark:bg-[#1a1a1a]"
            )}
            style={{ top: reactPos.top, left: reactPos.left }}
            role="toolbar"
            aria-label="Reações"
          >
            {DM_QUICK_REACTIONS.map((emoji) => {
              const active = myReaction === emoji;
              return (
                <button
                  key={emoji}
                  type="button"
                  title={emoji}
                  onClick={() => {
                    if (!currentUserId) return;
                    onReact(m.id, emoji);
                    setReactOpen(false);
                  }}
                  className={cn(
                    "inline-flex h-9 w-9 items-center justify-center rounded-full text-[20px] transition",
                    "hover:scale-110 hover:bg-neutral-100 active:scale-95 dark:hover:bg-zinc-800",
                    active &&
                      "bg-neutral-100 ring-2 ring-[#1f1f1f]/15 dark:bg-zinc-800"
                  )}
                >
                  {emoji}
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </div>
  );

  return (
    <>
      <div
        className={cn(
          // items-start: avatar não desce quando chips de reação aumentam a altura
          "group/msg flex items-start gap-2",
          isDm && mine && "flex-row-reverse"
        )}
      >
        <ProfileHoverCard userId={m.authorId} className="shrink-0 self-start">
          <Link href={`/app/u/${m.authorId}`} className="shrink-0">
            <Avatar
              name={m.authorName}
              src={author?.avatarUrl}
              size="sm"
              frame={author?.isVip ? (author.avatarFrame as never) : null}
            />
          </Link>
        </ProfileHoverCard>

        {/* Bolha + reações */}
        <div
          className={cn(
            "min-w-0 max-w-[min(100%,18.5rem)]",
            isDm && mine && "text-right"
          )}
        >
          <div
            className={cn(
              "flex flex-wrap items-baseline gap-2",
              isDm && mine && "justify-end"
            )}
          >
            <ProfileHoverCard userId={m.authorId}>
              <Link
                href={`/app/u/${m.authorId}`}
                className="inline-flex items-center gap-1 text-sm font-semibold text-[#1f1f1f] hover:underline dark:text-zinc-100"
              >
                {m.authorName}
                {author?.isVerified && <VerifiedBadge size={13} />}
              </Link>
            </ProfileHoverCard>
            <span className="text-[11px] text-neutral-400">
              {formatRelative(m.createdAt)}
            </span>
          </div>

          <div
            className={cn(
              "relative mt-0.5 cursor-pointer text-left select-none",
              isDm && mine && "ml-auto"
            )}
            onDoubleClick={handleDoubleLike}
            title="Clique duas vezes para amar"
          >
            {/* Heart pop no double-tap */}
            {heartPop && (
              <span
                className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
                aria-hidden
              >
                <span className="animate-ping text-[48px] opacity-80">❤️</span>
                <span className="absolute text-[40px] drop-shadow-lg">❤️</span>
              </span>
            )}

            {hasMedia ? (
              <div
                className={cn(
                  "inline-block max-w-full",
                  isDm && mine && "ml-auto"
                )}
              >
                <ChatMediaBubble message={m} mine={mine} />
              </div>
            ) : null}

            {note ? (
              <div
                className={cn(
                  "inline-block max-w-full rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                  hasMedia && "mt-1.5",
                  isDm && mine
                    ? "rounded-tr-sm bg-black text-white dark:bg-white dark:text-black"
                    : isDm
                      ? "rounded-tl-sm bg-neutral-100 text-neutral-800 dark:bg-zinc-800 dark:text-zinc-100"
                      : "rounded-2xl bg-neutral-100 text-neutral-700 dark:bg-zinc-800 dark:text-zinc-200"
                )}
              >
                <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                  {note}
                </p>
              </div>
            ) : null}

            {m.sharedPostId ? (
              <div
                className={cn(
                  note || hasMedia
                    ? "mt-2.5 border-t border-dashed border-neutral-200/90 pt-2.5 dark:border-zinc-700"
                    : "mt-0.5"
                )}
              >
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-400">
                  Post encaminhado
                </p>
                {shared ? (
                  <SharedPostEmbed post={shared} />
                ) : (
                  <p className="text-[12px] text-neutral-400">
                    Post original indisponível
                  </p>
                )}
              </div>
            ) : null}

            {/* Ticks WhatsApp — só nas minhas mensagens */}
            {mine && (
              <div
                className={cn(
                  "mt-0.5 flex items-center gap-1",
                  isDm ? "justify-end" : "justify-start"
                )}
              >
                <ChatMessageTicks
                  status={deliveryStatusOf(m, {
                    pending: m.id.startsWith("msg"),
                  })}
                  onDarkBubble={isDm}
                />
              </div>
            )}

            {/* Chips de reações */}
            {reactionEntries.length > 0 && (
              <div
                className={cn(
                  "mt-1 flex flex-wrap gap-1",
                  isDm && mine && "justify-end"
                )}
              >
                {reactionEntries.map(([emoji, ids]) => {
                  const mineReact = !!(
                    currentUserId && ids.includes(currentUserId)
                  );
                  return (
                    <button
                      key={emoji}
                      type="button"
                      title={`${ids.length} reação${ids.length > 1 ? "ões" : ""}`}
                      onClick={() => {
                        if (!currentUserId) return;
                        onReact(m.id, emoji);
                      }}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[13px] transition",
                        mineReact
                          ? "border-[#1f1f1f]/25 bg-[#1f1f1f]/5 dark:border-white/30 dark:bg-white/10"
                          : "border-neutral-200 bg-white hover:bg-neutral-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                      )}
                    >
                      <span>{emoji}</span>
                      <span className="text-[11px] font-semibold tabular-nums text-neutral-500 dark:text-zinc-400">
                        {ids.length}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Ações laterais — meio vertical (⋯) */}
        {sideActions}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Apagar mensagem?"
        description="Essa mensagem será removida da conversa. Isso não pode ser desfeito."
        confirmLabel="Apagar"
        cancelLabel="Cancelar"
        variant="danger"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          onDelete(m.id);
          setConfirmDelete(false);
        }}
      />
    </>
  );
}
