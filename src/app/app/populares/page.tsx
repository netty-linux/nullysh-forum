"use client";

import { StoriesTray } from "@/components/stories-tray";
import { PostCard } from "@/components/post-card";
import { useAuth } from "@/hooks/use-auth";
import { useBlockStore } from "@/lib/block-store";
import { rankFeedPosts } from "@/lib/feed-rank";
import { useForumStore } from "@/lib/forum-store";
import { Fire } from "@phosphor-icons/react";
import { useMemo } from "react";

/**
 * Aba Populares — stories de todo mundo + posts em alta.
 * Diferente do Feed, que só mostra quem você segue.
 */
export default function PopularesPage() {
  const { user } = useAuth();
  const posts = useForumStore((s) => s.posts);
  const blocks = useBlockStore((s) => s.blocks);
  const isEitherBlocked = useBlockStore((s) => s.isEitherBlocked);

  const popularPosts = useMemo(() => {
    void blocks;
    const filtered = !user
      ? posts
      : posts.filter(
          (p) =>
            p.authorId === user.id || !isEitherBlocked(user.id, p.authorId)
        );
    return rankFeedPosts(filtered).slice(0, 40);
  }, [posts, user, isEitherBlocked, blocks]);

  return (
    <div className="app-page mx-auto max-w-[var(--feed-max)] px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-5">
        <h1 className="flex items-center gap-2 font-display text-[32px] font-medium tracking-tight text-black dark:text-zinc-50">
          <Fire size={28} weight="fill" className="text-orange-500" />
          Populares
        </h1>
        <p className="mt-1.5 text-sm text-neutral-500">
          Stories e posts em alta de toda a comunidade. Siga quem você gostar
          para ver no feed.
        </p>
      </div>

      {/* Stories de todos (não só following) */}
      <div className="mb-6 rounded-2xl border border-neutral-200/90 bg-white px-3 py-3 shadow-[0_1px_3px_rgb(0_0_0/0.04)] dark:border-zinc-800 dark:bg-[#141414] sm:px-4">
        <div className="mb-2 flex items-center justify-between px-0.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
            Stories
          </p>
          <p className="text-[11px] text-neutral-400">expiram em 24h</p>
        </div>
        <StoriesTray
          user={
            user
              ? {
                  id: user.id,
                  name: user.name,
                  avatar: user.avatar,
                  avatarUrl: user.avatarUrl,
                }
              : null
          }
          mode="popular"
        />
      </div>

      <div className="mb-3">
        <h2 className="text-sm font-semibold text-[#1f1f1f] dark:text-zinc-100">
          Posts em alta
        </h2>
        <p className="mt-0.5 text-xs text-neutral-500">
          Ordenados por engajamento e recência.
        </p>
      </div>

      {popularPosts.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-neutral-200 bg-white px-6 py-14 text-center dark:border-zinc-700 dark:bg-[#141414]">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-orange-50 text-orange-500 dark:bg-orange-950/40">
            <Fire size={28} weight="regular" />
          </div>
          <h2 className="text-base font-semibold text-[#1f1f1f] dark:text-zinc-100">
            Nada popular ainda
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-neutral-500">
            Quando a galera postar, os conteúdos em alta aparecem aqui.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {popularPosts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
