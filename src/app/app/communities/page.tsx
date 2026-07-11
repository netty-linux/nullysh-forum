"use client";

import { CreateCommunityModal } from "@/components/create-community-modal";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { VipBadge } from "@/components/vip-gate";
import { useAuth } from "@/hooks/use-auth";
import {
  countPostsInCommunity,
} from "@/lib/community-hashtags";
import { useCommunityStore } from "@/lib/community-store";
import { useForumStore } from "@/lib/forum-store";
import type { Community } from "@/lib/types";
import {
  ChartLineUp,
  Code,
  CrownSimple,
  Hash,
  Heart,
  House,
  Lightbulb,
  Lightning,
  Lock,
  Megaphone,
  Palette,
  Plus,
  Robot,
  Rocket,
  SealCheck,
  Star,
  UsersThree,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

const iconMap = {
  House,
  Robot,
  ChartLineUp,
  Palette,
  UsersThree,
  Lightning,
  Megaphone,
  Lightbulb,
  Code,
  Heart,
  Star,
  Rocket,
} as const;

export default function CommunitiesPage() {
  const { user, isVip } = useAuth();
  const communities = useCommunityStore((s) => s.communities);
  const posts = useForumStore((s) => s.posts);
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);

  const staffList = communities.filter((c) => c.source === "staff");
  const memberList = communities.filter((c) => c.source === "member");

  const postCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of communities) {
      map.set(c.id, countPostsInCommunity(posts, c));
    }
    return map;
  }, [communities, posts]);

  return (
    <div className="app-page mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-[1.75rem] font-semibold tracking-tight text-[#1f1f1f] dark:text-zinc-50 sm:text-[2rem]">
            Assuntos
          </h1>
          <p className="mt-1.5 max-w-[42ch] text-[14px] leading-relaxed text-neutral-500">
            Posts com a #hashtag do assunto sincronizam automaticamente.
          </p>
        </div>

        {isVip ? (
          <Button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="shrink-0 rounded-full"
          >
            <Plus size={16} weight="bold" />
            Criar assunto
          </Button>
        ) : (
          <Link href="/pricing">
            <Button
              type="button"
              variant="outline"
              className="shrink-0 rounded-full"
            >
              <CrownSimple size={15} weight="fill" className="text-amber-500" />
              VIP cria assuntos
            </Button>
          </Link>
        )}
      </div>

      {communities.length === 0 ? (
        <EmptyState
          icon={<UsersThree size={28} weight="duotone" />}
          title="Nenhum assunto ainda"
          description={
            isVip
              ? "Seja o primeiro VIP a criar um assunto para a comunidade."
              : "Em breve o staff publicará assuntos oficiais. VIP pode criar os seus."
          }
          action={
            isVip ? (
              <Button type="button" onClick={() => setCreateOpen(true)}>
                <Plus size={16} weight="bold" />
                Criar assunto
              </Button>
            ) : (
              <Link href="/pricing">
                <Button variant="outline">Conhecer o VIP</Button>
              </Link>
            )
          }
        />
      ) : (
        <div className="space-y-8">
          {staffList.length > 0 && (
            <section>
              <div className="mb-3 flex items-center gap-2">
                <SealCheck
                  size={16}
                  weight="fill"
                  className="text-sky-500"
                />
                <h2 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
                  Oficiais · Staff
                </h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {staffList.map((c) => (
                  <CommunityCard
                    key={c.id}
                    community={c}
                    isVip={isVip}
                    postCount={postCounts.get(c.id) ?? 0}
                  />
                ))}
              </div>
            </section>
          )}

          {memberList.length > 0 && (
            <section>
              <div className="mb-3 flex items-center gap-2">
                <CrownSimple
                  size={15}
                  weight="fill"
                  className="text-amber-500"
                />
                <h2 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
                  Criadas por VIP
                </h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {memberList.map((c) => (
                  <CommunityCard
                    key={c.id}
                    community={c}
                    isVip={isVip}
                    postCount={postCounts.get(c.id) ?? 0}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {user && isVip && (
        <CreateCommunityModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          creatorId={user.id}
          creatorName={user.name}
          onCreated={(slug) => {
            router.push(`/app/communities/${slug}`);
          }}
        />
      )}
    </div>
  );
}

function CommunityCard({
  community: c,
  isVip,
  postCount,
}: {
  community: Community;
  isVip: boolean;
  postCount: number;
}) {
  const Icon =
    iconMap[c.icon as keyof typeof iconMap] ?? UsersThree;
  const locked = (c.vipOnly || c.access === "vip") && !isVip;

  return (
    <Link
      href={`/app/communities/${c.slug}`}
      className="card-interactive group relative flex flex-col rounded-2xl border border-neutral-200/90 bg-white p-6 shadow-[0_1px_2px_rgb(0_0_0/0.04)] dark:border-zinc-800 dark:bg-[#141414]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#1f1f1f] text-white transition-transform duration-200 group-hover:scale-105 dark:bg-zinc-100 dark:text-[#141414]">
          <Icon size={20} weight="fill" />
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {c.source === "staff" && (
            <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-800 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-300">
              <SealCheck size={11} weight="fill" />
              Staff
            </span>
          )}
          {(c.vipOnly || c.access === "vip") && <VipBadge />}
        </div>
      </div>
      <h2 className="mt-4 text-lg font-semibold tracking-tight text-[#1f1f1f] dark:text-zinc-50">
        {c.name}
      </h2>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-neutral-600 dark:text-zinc-400">
        {c.description}
      </p>

      <div className="mt-3 inline-flex w-fit items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[12px] font-semibold text-[#1f1f1f] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
        <Hash size={12} weight="bold" />
        {c.hashtag}
      </div>

      {c.source === "member" && (
        <p className="mt-2 text-[12px] text-neutral-400">
          por {c.creatorName}
        </p>
      )}
      <div className="mt-4 flex items-center justify-between border-t border-neutral-100 pt-3 text-xs font-medium tabular-nums text-neutral-500 dark:border-zinc-800">
        <span>
          {postCount} {postCount === 1 ? "post" : "posts"}
          {c.tagPolicy === "admin" ? " · admin posta" : ""}
        </span>
        {locked && (
          <span className="inline-flex items-center gap-1 font-semibold text-[#1f1f1f] dark:text-zinc-100">
            <Lock size={12} weight="bold" />
            VIP lê
          </span>
        )}
      </div>
    </Link>
  );
}
