"use client";

import { MaterialDropTimer } from "@/components/material-drop-timer";
import { Button } from "@/components/ui/button";
import { VipBadge } from "@/components/vip-gate";
import { useAuth } from "@/hooks/use-auth";
import { materials } from "@/lib/mock-data";
import { formatDate } from "@/lib/utils";
import {
  DownloadSimple,
  FilePdf,
  FileText,
  Link as LinkIcon,
  Lock,
  GraduationCap,
  SquaresFour,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useMemo, useState } from "react";

const typeIcon = {
  pdf: FilePdf,
  template: SquaresFour,
  checklist: FileText,
  link: LinkIcon,
  course: GraduationCap,
} as const;

const typeLabel = {
  pdf: "PDF",
  template: "Template",
  checklist: "Checklist",
  link: "Link",
  course: "Curso",
} as const;

export default function MaterialsPage() {
  const { isVip } = useAuth();
  const [category, setCategory] = useState("Todos");
  const [toast, setToast] = useState("");

  const categories = useMemo(() => {
    const set = new Set(materials.map((m) => m.category));
    return ["Todos", ...Array.from(set)];
  }, []);

  const list = useMemo(
    () =>
      category === "Todos"
        ? materials
        : materials.filter((m) => m.category === category),
    [category]
  );

  function handleDownload(title: string, locked: boolean) {
    if (locked) return;
    setToast(`Download simulado: ${title}`);
    setTimeout(() => setToast(""), 2200);
  }

  return (
    <div className="app-page mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-black">
          Materiais
        </h1>
        <p className="mt-2 text-base text-neutral-600">
          Templates, checklists, cursos e links curados da Nullysh.
        </p>
      </div>

      <MaterialDropTimer className="mb-6" />

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

      {toast && (
        <div className="mb-4 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700 shadow-sm">
          {toast}
        </div>
      )}

      <div className="space-y-3">
        {list.map((m) => {
          const Icon = typeIcon[m.type];
          const locked = m.vipOnly && !isVip;
          return (
            <div
              key={m.id}
              className="card-interactive flex flex-col gap-4 rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04)] sm:flex-row sm:items-center"
            >
              <div className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#1f1f1f] text-white">
                <Icon size={20} weight="fill" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-semibold text-black">{m.title}</h2>
                  <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-[10px] font-bold uppercase text-neutral-600">
                    {typeLabel[m.type]}
                  </span>
                  {m.vipOnly && <VipBadge />}
                </div>
                <p className="mt-1 text-sm leading-relaxed text-neutral-600">
                  {m.description}
                </p>
                <p className="mt-2 text-[11px] font-medium tabular-nums text-neutral-500">
                  {m.category}
                  {m.size ? ` · ${m.size}` : ""} ·{" "}
                  {m.downloads.toLocaleString("pt-BR")} downloads ·{" "}
                  {formatDate(m.createdAt)}
                </p>
              </div>
              {locked ? (
                <Link href="/pricing">
                  <Button variant="outline" className="w-full sm:w-auto">
                    <Lock size={14} weight="bold" />
                    VIP
                  </Button>
                </Link>
              ) : (
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => handleDownload(m.title, locked)}
                >
                  <DownloadSimple size={16} weight="bold" />
                  Baixar
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
