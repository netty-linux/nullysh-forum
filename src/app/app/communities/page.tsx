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
    <div className="app-page mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-black">
          Comunidades
        </h1>
        <p className="mt-2 text-base text-neutral-600">
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
              className="card-interactive group relative flex flex-col rounded-2xl border border-neutral-200/90 bg-white p-6 shadow-[0_1px_2px_rgb(0_0_0/0.04)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#1f1f1f] text-white transition-transform duration-200 group-hover:scale-105">
                  <Icon size={20} weight="fill" />
                </div>
                {c.vipOnly && <VipBadge />}
              </div>
              <h2 className="mt-4 text-lg font-semibold text-black">{c.name}</h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-neutral-600">
                {c.description}
              </p>
              <div className="mt-5 flex items-center justify-between border-t border-neutral-100 pt-3 text-xs font-medium tabular-nums text-neutral-500">
                <span>
                  {c.members.toLocaleString("pt-BR")} membros · {c.posts} posts
                </span>
                {locked && (
                  <span className="inline-flex items-center gap-1 font-bold text-black">
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
