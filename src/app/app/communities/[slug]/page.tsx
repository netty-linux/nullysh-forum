"use client";

import { PostCard } from "@/components/post-card";
import { Button } from "@/components/ui/button";
import { VipGate } from "@/components/vip-gate";
import { useAuth } from "@/hooks/use-auth";
import {
  canReadCommunity,
  countPostsInCommunity,
  postMatchesCommunity,
} from "@/lib/community-hashtags";
import { useCommunityStore } from "@/lib/community-store";
import { useForumStore } from "@/lib/forum-store";
import {
  ArrowLeft,
  CrownSimple,
  Hash,
  SealCheck,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";

export default function CommunityDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const community = useCommunityStore((s) =>
    s.communities.find((c) => c.slug === slug)
  );
  const posts = useForumStore((s) => s.posts);
  const { user, isVip } = useAuth();
  const isAdmin = user?.role === "admin";

  const communityPosts = useMemo(() => {
    if (!community) return [];
    return posts
      .filter((p) => postMatchesCommunity(p, community))
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }, [posts, community]);

  if (!community) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-sm text-neutral-500">Comunidade não encontrada.</p>
        <Link href="/app/communities" className="mt-4 inline-block">
          <Button variant="outline">Voltar</Button>
        </Link>
      </div>
    );
  }

  const canRead = canReadCommunity(community, {
    isVip: !!isVip,
    isAdmin,
  });
  const vipOnly = community.vipOnly || community.access === "vip";
  const postCount = countPostsInCommunity(posts, community);

  if (!canRead) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Link
          href="/app/communities"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-950"
        >
          <ArrowLeft size={16} />
          Comunidades
        </Link>
        <VipGate
          title={`${community.name} é VIP`}
          description={`Esta comunidade é exclusiva VIP. Só membros VIP marcam #${community.hashtag} e leem os posts.`}
        />
      </div>
    );
  }

  return (
    <div className="app-page mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <Link
        href="/app/communities"
        className="mb-6 inline-flex items-center gap-1.5 text-[13px] text-neutral-500 transition-colors hover:text-neutral-950"
      >
        <ArrowLeft size={15} />
        Comunidades
      </Link>

      <div className="surface-card-quiet mb-7 p-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {community.source === "staff" ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-800">
              <SealCheck size={11} weight="fill" />
              Staff oficial
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900">
              <CrownSimple size={11} weight="fill" />
              Criada por VIP
            </span>
          )}
          {vipOnly && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#1f1f1f] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
              VIP
            </span>
          )}
          {community.tagPolicy === "admin" && (
            <span className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-600">
              Posta só admin
            </span>
          )}
        </div>
        <h1 className="text-[1.5rem] font-semibold tracking-[-0.03em] text-neutral-950 dark:text-zinc-50">
          {community.name}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-neutral-500">
          {community.description}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-[#1f1f1f] bg-white px-3 py-1 text-[13px] font-bold text-[#1f1f1f] dark:border-zinc-100 dark:bg-zinc-900 dark:text-zinc-50">
            <Hash size={14} weight="bold" />
            {community.hashtag}
          </span>
          <span className="text-[12px] text-neutral-400">
            Marque esta tag no post para sincronizar
          </span>
        </div>

        <p className="mt-4 text-xs tabular-nums text-neutral-400">
          {postCount} {postCount === 1 ? "post" : "posts"}
          {community.source === "member" && (
            <> · por {community.creatorName}</>
          )}
        </p>
      </div>

      <div className="space-y-3">
        {communityPosts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
        {communityPosts.length === 0 && (
          <div className="rounded-2xl border border-dashed border-neutral-200 bg-white p-10 text-center text-sm text-neutral-400 dark:border-zinc-700 dark:bg-[#141414]">
            <p className="font-medium text-neutral-600 dark:text-zinc-300">
              Nenhum post com #{community.hashtag} ainda
            </p>
            <p className="mt-2 text-[13px] leading-relaxed">
              {community.tagPolicy === "admin"
                ? "Apenas administradores podem publicar com esta hashtag."
                : `Publique no feed usando #${community.hashtag} para aparecer aqui.`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
