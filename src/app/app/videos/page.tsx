"use client";

import { VipBadge } from "@/components/vip-gate";
import { useAuth } from "@/hooks/use-auth";
import { videos } from "@/lib/mock-data";
import { formatDate } from "@/lib/utils";
import { Lock, Play } from "@phosphor-icons/react";
import Link from "next/link";
import { useMemo, useState } from "react";

export default function VideosPage() {
  const { isVip } = useAuth();
  const [category, setCategory] = useState("Todos");

  const categories = useMemo(() => {
    const set = new Set(videos.map((v) => v.category));
    return ["Todos", ...Array.from(set)];
  }, []);

  const list = useMemo(
    () =>
      category === "Todos"
        ? videos
        : videos.filter((v) => v.category === category),
    [category]
  );

  return (
    <div className="app-page mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-black">
          Vídeos
        </h1>
        <p className="mt-2 text-base text-neutral-600">
          Tutoriais, aulas e tours da metodologia Nullysh.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={
              category === c
                ? "chip rounded-full bg-[#1f1f1f] px-3 py-1.5 text-xs font-medium text-white shadow-sm"
                : "chip rounded-full bg-white px-3 py-1.5 text-xs font-medium text-neutral-500 ring-1 ring-neutral-200 hover:text-[#1f1f1f]"
            }
          >
            {c}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((v) => {
          const locked = v.vipOnly && !isVip;
          const Card = (
            <article className="card-interactive group flex h-full flex-col overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
              <div className="relative flex aspect-video items-center justify-center border-b border-neutral-100 bg-neutral-100">
                <div className="absolute inset-0 hero-grid opacity-50" />
                <span className="relative font-mono text-5xl font-bold tabular-nums text-neutral-300">
                  {v.thumbnail}
                </span>
                <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-all duration-300 group-hover:opacity-100">
                  <span className="inline-flex h-12 w-12 scale-90 items-center justify-center rounded-full bg-[#1f1f1f] text-white shadow-lg transition-transform duration-300 group-hover:scale-100">
                    {locked ? (
                      <Lock size={18} weight="bold" />
                    ) : (
                      <Play size={18} weight="fill" className="ml-0.5" />
                    )}
                  </span>
                </div>
                <span className="absolute bottom-2 right-2 rounded-md bg-[#1f1f1f] px-2 py-0.5 text-[10px] font-bold tabular-nums text-white">
                  {v.duration}
                </span>
              </div>
              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">
                    {v.category}
                  </span>
                  {v.vipOnly && <VipBadge />}
                </div>
                <h2 className="mt-2 text-sm font-semibold leading-snug text-black">
                  {v.title}
                </h2>
                <p className="mt-1.5 flex-1 text-xs leading-relaxed text-neutral-600">
                  {v.description}
                </p>
                <p className="mt-3 text-[11px] font-medium tabular-nums text-neutral-500">
                  {v.views.toLocaleString("pt-BR")} views ·{" "}
                  {formatDate(v.createdAt)}
                </p>
              </div>
            </article>
          );

          if (locked) {
            return (
              <Link key={v.id} href="/pricing">
                {Card}
              </Link>
            );
          }

          return (
            <div key={v.id} role="button" tabIndex={0}>
              {Card}
            </div>
          );
        })}
      </div>
    </div>
  );
}
