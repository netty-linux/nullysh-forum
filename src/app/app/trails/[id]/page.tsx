"use client";

import { TrailRichHtml } from "@/components/trail-rich-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TagList } from "@/components/tag-chips";
import { useAuth } from "@/hooks/use-auth";
import type { TrailAttachment, TrailLink } from "@/lib/catalog";
import { useProgressStore } from "@/lib/progress-store";
import {
  formatFileSize,
  loadTrailAttachmentDataUrl,
} from "@/lib/trail-attachments";
import { sanitizeTrailHtml } from "@/lib/trail-html";
import { useTrailStore } from "@/lib/trail-store";
import {
  ArrowLeft,
  CheckCircle,
  Circle,
  DownloadSimple,
  FilmStrip,
  Link as LinkIcon,
  Lock,
  Paperclip,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback } from "react";

const typeLabel = {
  video: "Vídeo",
  material: "Material",
  practice: "Prática",
  live: "Live",
} as const;

export default function TrailDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const trail = useTrailStore((s) => s.trails.find((t) => t.id === id));
  const { isVip } = useAuth();
  const progress = useProgressStore((s) =>
    s.trails.find((t) => t.trailId === id)
  );
  const toggleTrailStep = useProgressStore((s) => s.toggleTrailStep);

  const downloadAttachment = useCallback(async (a: TrailAttachment) => {
    try {
      const dataUrl = await loadTrailAttachmentDataUrl(a.storageKey);
      if (!dataUrl) {
        window.alert("Arquivo não encontrado neste dispositivo.");
        return;
      }
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const el = document.createElement("a");
      el.href = url;
      el.download = a.name || "anexo";
      document.body.appendChild(el);
      el.click();
      el.remove();
      URL.revokeObjectURL(url);
    } catch {
      window.alert("Não foi possível baixar o arquivo.");
    }
  }, []);

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
  const total = trail.steps.length;
  const pct = total ? Math.round((done.length / total) * 100) : 0;
  const safeHtml = sanitizeTrailHtml(trail.description);
  const trailLinks = trail.links || [];
  const trailAttachments = trail.attachments || [];

  return (
    <div className="app-page mx-auto min-w-0 max-w-2xl overflow-x-hidden px-4 py-8 sm:px-6 sm:py-10">
      <Link
        href="/app/trails"
        className="mb-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-neutral-500 hover:text-[#1f1f1f]"
      >
        <ArrowLeft size={15} weight="bold" />
        Trilhas
      </Link>

      <div className="mb-6 min-w-0 overflow-hidden rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04)] sm:p-6">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h1 className="min-w-0 max-w-full break-words text-xl font-semibold tracking-tight text-[#1f1f1f] [overflow-wrap:anywhere] sm:text-2xl">
            {trail.title}
          </h1>
          <Badge variant="outline" className="shrink-0 capitalize">
            {trail.level}
          </Badge>
        </div>
        <div className="mt-3">
          <TrailRichHtml html={safeHtml} />
        </div>
        <div className="mt-3 min-w-0">
          <TagList tags={trail.interestTags} />
        </div>

        {(trailLinks.length > 0 || trailAttachments.length > 0) && (
          <div className="mt-5 space-y-3 border-t border-neutral-100 pt-4">
            {trailLinks.length > 0 && (
              <ResourceLinks list={trailLinks} />
            )}
            {trailAttachments.length > 0 && (
              <ResourceAttachments
                list={trailAttachments}
                onDownload={downloadAttachment}
              />
            )}
          </div>
        )}

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

      <ol className="min-w-0 space-y-3">
        {trail.steps.map((step, i) => {
          const completed = done.includes(step.id);
          const stepLinks = step.links || [];
          const stepAttachments = step.attachments || [];
          return (
            <li
              key={step.id}
              className="flex min-w-0 gap-3 overflow-hidden rounded-2xl border border-neutral-200/90 bg-white p-4 shadow-[0_1px_2px_rgb(0_0_0/0.04)] sm:p-5"
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
                  <CheckCircle
                    size={24}
                    weight="fill"
                    className="text-emerald-600"
                  />
                ) : (
                  <Circle size={24} className="text-neutral-300" />
                )}
              </button>
              <div className="min-w-0 flex-1 overflow-hidden">
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
                      ? "mt-1 break-words text-sm font-semibold text-neutral-400 line-through [overflow-wrap:anywhere]"
                      : "mt-1 break-words text-sm font-semibold text-[#1f1f1f] [overflow-wrap:anywhere]"
                  }
                >
                  {step.title}
                </h2>
                {step.description ? (
                  <p className="mt-1 max-w-full break-words text-sm leading-relaxed text-neutral-600 [overflow-wrap:anywhere]">
                    {step.description}
                  </p>
                ) : null}

                {step.videoId ? (
                  <Link
                    href={`/app/videos?id=${encodeURIComponent(step.videoId)}`}
                    className="mt-3 inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-[13px] font-semibold text-[#1f1f1f] transition hover:border-[#1f1f1f] hover:bg-white"
                  >
                    <FilmStrip size={16} weight="fill" className="text-sky-600" />
                    <span className="min-w-0 truncate">
                      {step.videoTitle || "Assistir vídeo"}
                    </span>
                  </Link>
                ) : null}

                {(stepLinks.length > 0 || stepAttachments.length > 0) && (
                  <div className="mt-3 space-y-2">
                    {stepLinks.length > 0 && (
                      <ResourceLinks list={stepLinks} compact />
                    )}
                    {stepAttachments.length > 0 && (
                      <ResourceAttachments
                        list={stepAttachments}
                        onDownload={downloadAttachment}
                        compact
                      />
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function ResourceLinks({
  list,
  compact,
}: {
  list: TrailLink[];
  compact?: boolean;
}) {
  return (
    <div>
      <p
        className={cnLabel(compact)}
      >
        <LinkIcon size={12} weight="bold" />
        Links
      </p>
      <ul className="mt-1.5 flex flex-wrap gap-2">
        {list.map((l) => (
          <li key={l.id}>
            <a
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-sky-700 transition hover:border-sky-300 hover:bg-sky-50"
            >
              <LinkIcon size={12} weight="bold" />
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ResourceAttachments({
  list,
  onDownload,
  compact,
}: {
  list: TrailAttachment[];
  onDownload: (a: TrailAttachment) => void;
  compact?: boolean;
}) {
  return (
    <div>
      <p className={cnLabel(compact)}>
        <Paperclip size={12} weight="bold" />
        Anexos
      </p>
      <ul className="mt-1.5 space-y-1.5">
        {list.map((a) => (
          <li key={a.id}>
            <button
              type="button"
              onClick={() => onDownload(a)}
              className="flex w-full items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-left text-[12px] transition hover:border-[#1f1f1f] hover:bg-white"
            >
              <span className="min-w-0 truncate font-medium text-[#1f1f1f]">
                {a.name}
                <span className="ml-1.5 font-normal text-neutral-400">
                  {formatFileSize(a.size)}
                </span>
              </span>
              <DownloadSimple
                size={16}
                weight="bold"
                className="shrink-0 text-neutral-500"
              />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function cnLabel(compact?: boolean) {
  return compact
    ? "flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-400"
    : "flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400";
}
