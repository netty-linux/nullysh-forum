"use client";

import { VipBadge } from "@/components/vip-gate";
import { useAuth } from "@/hooks/use-auth";
import { communities } from "@/lib/mock-data";
import {
  ChartLineUp,
  House,
  Lock,
  Palette,
  Robot,
  UsersThree,
} from "@phosphor-icons/react";
import Link from "next/link";

const iconMap = {
  House,
  Robot,
  ChartLineUp,
  Palette,
  UsersThree,
} as const;

export default function CommunitiesPage() {
  const { isVip } = useAuth();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-950">
          Comunidades
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Espaços temáticos dentro do Nullysh Forum.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {communities.map((c) => {
          const Icon =
            iconMap[c.icon as keyof typeof iconMap] ?? UsersThree;
          const locked = c.vipOnly && !isVip;
          return (
            <Link
              key={c.id}
              href={locked ? "/pricing" : `/app/communities/${c.slug}`}
              className="group relative flex flex-col rounded-2xl border border-neutral-200/80 bg-white p-6 transition-all hover:border-neutral-400 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-neutral-100 text-neutral-950 transition-colors group-hover:bg-neutral-950 group-hover:text-white">
                  <Icon size={20} weight="fill" />
                </div>
                {c.vipOnly && <VipBadge />}
              </div>
              <h2 className="mt-4 text-lg font-semibold tracking-tight text-neutral-950">
                {c.name}
              </h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-neutral-500">
                {c.description}
              </p>
              <div className="mt-5 flex items-center justify-between text-xs text-neutral-400">
                <span>
                  {c.members.toLocaleString("pt-BR")} membros · {c.posts} posts
                </span>
                {locked && (
                  <span className="inline-flex items-center gap-1 font-medium text-neutral-600">
                    <Lock size={12} weight="bold" />
                    VIP
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
