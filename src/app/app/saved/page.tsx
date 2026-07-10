"use client";

import { EmptyState } from "@/components/empty-state";
import { PostCard } from "@/components/post-card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useBlockStore } from "@/lib/block-store";
import { useForumStore } from "@/lib/forum-store";
import { BookmarkSimple } from "@phosphor-icons/react";
import Link from "next/link";
import { useMemo } from "react";

export default function SavedPostsPage() {
  const { user } = useAuth();
  const posts = useForumStore((s) => s.posts);
  const isEitherBlocked = useBlockStore((s) => s.isEitherBlocked);
  const blocks = useBlockStore((s) => s.blocks);

  const saved = useMemo(() => {
    if (!user) return [];
    return posts
      .filter(
        (p) =>
          (p.savedBy ?? []).includes(user.id) &&
          (p.authorId === user.id || !isEitherBlocked(user.id, p.authorId))
      )
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }, [posts, user, isEitherBlocked, blocks]);

  return (
    <div className="app-page mx-auto max-w-[var(--feed-max)] px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 font-display text-[32px] font-medium tracking-tight text-black dark:text-zinc-50">
              <BookmarkSimple
                size={28}
                weight="fill"
                className="text-amber-500"
              />
              Salvos
            </h1>
            <p className="mt-1.5 text-sm text-neutral-500">
              {saved.length === 0
                ? "Posts que você salvar no feed aparecem aqui."
                : `${saved.length} post${saved.length === 1 ? "" : "s"} guardado${saved.length === 1 ? "" : "s"} para ver depois.`}
            </p>
          </div>
        </div>
      </div>

      {saved.length === 0 ? (
        <EmptyState
          icon={<BookmarkSimple size={28} weight="regular" aria-hidden />}
          title="Nenhum post salvo ainda"
          description="No feed, toque em Salvar (bookmark) no canto direito de um post para guardá-lo aqui."
          action={
            <Link href="/app">
              <Button type="button">Ir para o Feed</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {saved.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
