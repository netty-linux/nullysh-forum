"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TagList } from "@/components/tag-chips";
import { useAuth } from "@/hooks/use-auth";
import { LEARNING_TRAILS } from "@/lib/catalog";
import { useProgressStore } from "@/lib/progress-store";
import {
  ArrowLeft,
  CheckCircle,
  Circle,
  Lock,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useParams } from "next/navigation";

const typeLabel = {
  video: "Vídeo",
  material: "Material",
  practice: "Prática",
  live: "Live",
} as const;

export default function TrailDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const trail = LEARNING_TRAILS.find((t) => t.id === id);
  const { isVip } = useAuth();
  const progress = useProgressStore((s) =>
    s.trails.find((t) => t.trailId === id)
  );
  const toggleTrailStep = useProgressStore((s) => s.toggleTrailStep);

  if (!trail) {
    return (
      <div className="app-page mx-auto max-w-xl px-4 py-16 text-center">
        <p className="font-semibold text-[#1f1f1f]">Trilha não encontrada</p>
        <Link href="/app/trails" className="mt-4 inline-block">
          <Button variant="outline">Voltar</Button>
        </Link>
      </div>
    );
  }

  if (trail.vipOnly && !isVip) {
    return (
      <div className="app-page mx-auto max-w-xl px-4 py-16 text-center">
        <Lock size={28} weight="bold" className="mx-auto text-[#1f1f1f]" />
        <p className="mt-3 font-semibold text-[#1f1f1f]">
          Trilha exclusiva VIP
        </p>
        <p className="mt-2 text-sm text-neutral-500">
          Assine o Plano VIP para liberar esta trilha completa.
        </p>
        <Link href="/pricing" className="mt-6 inline-block">
          <Button>Ver Plano VIP</Button>
        </Link>
      </div>
    );
  }

  const done = progress?.completedStepIds ?? [];
  const pct = Math.round((done.length / trail.steps.length) * 100);

  return (
    <div className="app-page mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
      <Link
        href="/app/trails"
        className="mb-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-neutral-500 hover:text-[#1f1f1f]"
      >
        <ArrowLeft size={15} weight="bold" />
        Trilhas
      </Link>

      <div className="mb-6 rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04)] sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight text-[#1f1f1f] sm:text-2xl">
            {trail.title}
          </h1>
          <Badge variant="outline" className="capitalize">
            {trail.level}
          </Badge>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600">
          {trail.description}
        </p>
        <div className="mt-3">
          <TagList tags={trail.interestTags} />
        </div>
        <div className="mt-5">
          <div className="mb-1.5 flex justify-between text-[11px] font-medium text-neutral-400">
            <span>
              {done.length}/{trail.steps.length} concluídas
            </span>
            <span className="tabular-nums">{pct}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100">
            <div
              className="h-full rounded-full bg-[#1f1f1f] transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      <ol className="space-y-3">
        {trail.steps.map((step, i) => {
          const completed = done.includes(step.id);
          return (
            <li
              key={step.id}
              className="flex gap-3 rounded-2xl border border-neutral-200/90 bg-white p-4 shadow-[0_1px_2px_rgb(0_0_0/0.04)] sm:p-5"
            >
              <button
                type="button"
                onClick={() => toggleTrailStep(trail.id, step.id)}
                className="pressable mt-0.5 shrink-0 text-[#1f1f1f]"
                aria-label={
                  completed ? "Desmarcar etapa" : "Marcar etapa como feita"
                }
              >
                {completed ? (
                  <CheckCircle size={24} weight="fill" className="text-emerald-600" />
                ) : (
                  <Circle size={24} className="text-neutral-300" />
                )}
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-semibold tabular-nums text-neutral-400">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <Badge variant="outline">{typeLabel[step.type]}</Badge>
                  {step.duration && (
                    <span className="text-[11px] text-neutral-400">
                      {step.duration}
                    </span>
                  )}
                </div>
                <h2
                  className={
                    completed
                      ? "mt-1 text-sm font-semibold text-neutral-400 line-through"
                      : "mt-1 text-sm font-semibold text-[#1f1f1f]"
                  }
                >
                  {step.title}
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-neutral-600">
                  {step.description}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
