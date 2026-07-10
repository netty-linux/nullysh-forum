"use client";

import { PostCard } from "@/components/post-card";
import { VipGate } from "@/components/vip-gate";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { communities } from "@/lib/mock-data";
import { useForumStore } from "@/lib/forum-store";
import { ArrowLeft } from "@phosphor-icons/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";

export default function CommunityDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const community = communities.find((c) => c.slug === slug);
  const posts = useForumStore((s) => s.posts);
  const { isVip } = useAuth();

  const communityPosts = useMemo(
    () =>
      posts
        .filter((p) => p.communityId === community?.id)
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ),
    [posts, community?.id]
  );

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

  if (community.vipOnly && !isVip) {
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
          description="Assine o Plano VIP para entrar nesta comunidade e participar das discussões."
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
        <h1 className="text-[1.5rem] font-semibold tracking-[-0.03em] text-neutral-950">
          {community.name}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-neutral-500">
          {community.description}
        </p>
        <p className="mt-4 text-xs tabular-nums text-neutral-400">
          {community.members.toLocaleString("pt-BR")} membros ·{" "}
          {community.posts} posts
        </p>
      </div>

      <div className="space-y-3">
        {communityPosts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
        {communityPosts.length === 0 && (
          <div className="rounded-2xl border border-dashed border-neutral-200 bg-white p-10 text-center text-sm text-neutral-400">
            Nenhum post nesta comunidade ainda. Publique pelo Feed e marque a
            comunidade.
          </div>
        )}
      </div>
    </div>
  );
}
