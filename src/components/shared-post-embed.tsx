"use client";

import { LazyGif } from "@/components/lazy-gif";
import { Avatar } from "@/components/ui/avatar";
import { useAuthStore } from "@/lib/auth-store";
import type { Post } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Image as ImageIcon, LinkSimple } from "@phosphor-icons/react";
import Link from "next/link";

/** Metade do texto (por caracteres), com corte em palavra quando possível */
export function halfPostText(content: string, max = 120): string {
  const t = (content || "").trim().replace(/\s+/g, " ");
  if (!t) return "";
  const target = Math.min(max, Math.max(40, Math.ceil(t.length / 2)));
  if (t.length <= target) return t;
  const slice = t.slice(0, target);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > target * 0.5 ? slice.slice(0, lastSpace) : slice;
  return cut.trimEnd() + "…";
}

type Props = {
  post: Post;
  /** Bolha do remetente (DM própria) usa contraste claro no fundo escuro */
  variant?: "default" | "onDark" | "onLight";
  className?: string;
};

/**
 * Preview rico de post encaminhado no bate-papo.
 * Imagem em thumbnail + texto resumido (~metade).
 */
export function SharedPostEmbed({
  post,
  variant = "default",
  className,
}: Props) {
  const author = useAuthStore((s) =>
    s.users.find((u) => u.id === post.authorId)
  );
  const excerpt = halfPostText(post.content);
  const mediaSrc = post.imageUrl || post.gifUrl || null;
  const hasImage = !!mediaSrc;

  const onDark = variant === "onDark";
  const onLight = variant === "onLight";

  return (
    <Link
      href="/app"
      className={cn(
        "group block max-w-[min(100%,17.5rem)] overflow-hidden rounded-2xl border text-left transition",
        "hover:opacity-[0.97] active:scale-[0.99]",
        onDark
          ? "border-white/20 bg-white/[0.08] shadow-[inset_0_0_0_1px_rgb(255_255_255/0.04)]"
          : onLight
            ? "border-black/10 bg-black/[0.04]"
            : "border-neutral-200 bg-white shadow-[0_1px_3px_rgb(0_0_0/0.06)] dark:border-zinc-700 dark:bg-zinc-900",
        className
      )}
    >
      {/* Thumbnail */}
      {hasImage ? (
        <div
          className={cn(
            "relative w-full overflow-hidden bg-neutral-200 dark:bg-zinc-800",
            post.gifUrl ? "max-h-36" : "aspect-[16/10]"
          )}
        >
          {post.gifUrl ? (
            <LazyGif
              src={post.gifUrl}
              alt=""
              className="w-full"
              maxHeightClass="max-h-36"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mediaSrc!}
              alt=""
              className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
              loading="lazy"
              decoding="async"
            />
          )}
          {!post.gifUrl && (
            <span
              className={cn(
                "absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold backdrop-blur-md",
                "bg-black/55 text-white"
              )}
            >
              <ImageIcon size={11} weight="bold" />
              Foto
            </span>
          )}
        </div>
      ) : null}

      <div className="p-2.5 sm:p-3">
        <div className="flex items-center gap-2">
          <Avatar
            name={post.authorName}
            src={author?.avatarUrl ?? post.authorAvatarUrl}
            size="sm"
            frame={author?.isVip ? author.avatarFrame : null}
          />
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "truncate text-[12px] font-semibold",
                onDark
                  ? "text-white"
                  : onLight
                    ? "text-[#1f1f1f]"
                    : "text-[#1f1f1f] dark:text-zinc-100"
              )}
            >
              {post.authorName}
            </p>
            <p
              className={cn(
                "flex items-center gap-1 text-[10px] font-medium",
                onDark
                  ? "text-white/55"
                  : onLight
                    ? "text-neutral-500"
                    : "text-neutral-400"
              )}
            >
              <LinkSimple size={10} weight="bold" />
              Post no Nullysh
            </p>
          </div>
        </div>

        {excerpt ? (
          <p
            className={cn(
              "mt-2 line-clamp-3 text-[13px] leading-snug [overflow-wrap:anywhere]",
              onDark
                ? "text-white/90"
                : onLight
                  ? "text-neutral-700"
                  : "text-neutral-600 dark:text-zinc-300"
            )}
          >
            {excerpt}
          </p>
        ) : hasImage ? (
          <p
            className={cn(
              "mt-2 text-[12px] italic",
              onDark ? "text-white/50" : "text-neutral-400"
            )}
          >
            Publicação com imagem
          </p>
        ) : null}
      </div>
    </Link>
  );
}
