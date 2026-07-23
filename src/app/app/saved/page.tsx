"use client";

import { EmptyState } from "@/components/empty-state";
import { PostCard } from "@/components/post-card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useBlockStore } from "@/lib/block-store";
import { useForumStore } from "@/lib/forum-store";
import {
  ArrowRight,
  BookmarkSimple,
  MagnifyingGlass,
  Sparkle,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useMemo, useState } from "react";

export default function SavedPostsPage() {
  const { user } = useAuth();
  const posts = useForumStore((s) => s.posts);
  const isEitherBlocked = useBlockStore((s) => s.isEitherBlocked);
  const blocks = useBlockStore((s) => s.blocks);

  const [searchQuery, setSearchQuery] = useState("");

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

  const filteredSaved = useMemo(() => {
    if (!searchQuery.trim()) return saved;
    const q = searchQuery.toLowerCase().trim();
    return saved.filter(
      (p) =>
        p.content.toLowerCase().includes(q) ||
        p.authorName.toLowerCase().includes(q)
    );
  }, [saved, searchQuery]);

  return (
    <div className="app-page mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
      {/* Header section */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-200/80 bg-amber-50/80 px-3 py-1 text-[12px] font-semibold text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300 mb-3">
            <BookmarkSimple size={15} weight="fill" />
            Coleção Pessoal & Salvos
          </div>
          <h1 className="font-display text-[1.75rem] font-semibold tracking-tight text-[#1f1f1f] dark:text-zinc-50 sm:text-[2.25rem]">
            Posts Salvos
          </h1>
          <p className="mt-2 text-[14px] leading-relaxed text-neutral-500 dark:text-zinc-400">
            Sua biblioteca de conteúdos, tutoriais e discussões guardadas para consulta rápida.
          </p>
        </div>

        {saved.length > 0 && (
          <div className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200/80 bg-white px-3.5 py-1.5 text-xs font-semibold text-neutral-700 shadow-sm dark:border-zinc-800 dark:bg-[#141414] dark:text-zinc-300 shrink-0">
            <BookmarkSimple size={14} weight="fill" className="text-amber-500" />
            <span>{saved.length} guardado{saved.length === 1 ? "" : "s"}</span>
          </div>
        )}
      </div>

      {/* Search filter input if user has saved posts */}
      {saved.length > 0 && (
        <div className="mb-6 relative">
          <MagnifyingGlass
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-zinc-500"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar nos seus posts salvos..."
            className="w-full rounded-2xl border border-neutral-200/90 bg-white py-2.5 pl-10 pr-4 text-xs sm:text-sm text-neutral-900 placeholder-neutral-400 shadow-xs transition-all focus:border-neutral-400 focus:outline-none dark:border-zinc-800 dark:bg-[#141414] dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-700"
          />
        </div>
      )}

      {/* Stream list or Empty State */}
      {saved.length === 0 ? (
        <div className="rounded-3xl border border-neutral-200/90 bg-white p-8 sm:p-12 text-center shadow-sm dark:border-zinc-800 dark:bg-[#141414]">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 dark:bg-amber-500/20">
            <BookmarkSimple size={28} weight="fill" />
          </div>
          <h2 className="font-display text-base font-semibold text-[#1f1f1f] dark:text-zinc-100">
            Nenhum post salvo ainda
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-xs sm:text-sm leading-relaxed text-neutral-500 dark:text-zinc-400">
            No feed, toque no ícone de <span className="font-semibold text-neutral-800 dark:text-zinc-200">Salvar</span> no canto do post para guardá-lo na sua biblioteca pessoal.
          </p>
          <div className="mt-6">
            <Link href="/app">
              <Button type="button" className="rounded-full gap-1.5 font-semibold">
                Explorar o Feed <ArrowRight size={14} />
              </Button>
            </Link>
          </div>
        </div>
      ) : filteredSaved.length === 0 ? (
        <EmptyState
          icon={<BookmarkSimple size={28} weight="duotone" />}
          title="Nenhum post encontrado na busca"
          description="Tente buscar por outros termos ou limpe o filtro."
          action={
            <Button variant="outline" onClick={() => setSearchQuery("")}>
              Limpar busca
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {filteredSaved.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}

