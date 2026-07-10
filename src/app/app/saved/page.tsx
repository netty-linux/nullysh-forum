"use client";

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
    <div className="app-page mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
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
        <div className="rounded-2xl border-2 border-dashed border-neutral-200 bg-white px-6 py-14 text-center dark:border-zinc-700 dark:bg-[#141414]">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-500 dark:bg-amber-950/40">
            <BookmarkSimple size={28} weight="regular" />
          </div>
          <h2 className="text-base font-semibold text-[#1f1f1f] dark:text-zinc-100">
            Nenhum post salvo ainda
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-neutral-500">
            No feed, toque no ícone de{" "}
            <span className="font-semibold text-neutral-700 dark:text-zinc-300">
              Salvar
            </span>{" "}
            (bookmark) no canto direito de um post para guardá-lo aqui.
          </p>
          <div className="mt-6">
            <Link href="/app">
              <Button type="button">Ir para o Feed</Button>
            </Link>
          </div>
        </div>
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
