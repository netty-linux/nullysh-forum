"use client";

import { EmptyState } from "@/components/empty-state";
import { MaterialDropTimer } from "@/components/material-drop-timer";
import { Button } from "@/components/ui/button";
import { VipBadge } from "@/components/vip-gate";
import { useAuth } from "@/hooks/use-auth";
import { redactMaterialsForViewer } from "@/lib/access-control";
import { useMaterialStore } from "@/lib/material-store";
import { formatDate } from "@/lib/utils";
import {
  Books,
  DownloadSimple,
  FilePdf,
  FileText,
  Link as LinkIcon,
  Lock,
  GraduationCap,
  SquaresFour,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

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
  const { isVip, user } = useAuth();
  const searchParams = useSearchParams();
  const focusId = searchParams.get("id");
  const materialsRaw = useMaterialStore((s) => s.materials);
  const recordDownload = useMaterialStore((s) => s.recordDownload);
  const [category, setCategory] = useState("Todos");
  const [toast, setToast] = useState("");

  // AppSec: free nunca recebe URL de material VIP no React tree
  const materials = useMemo(
    () =>
      redactMaterialsForViewer(materialsRaw, {
        isVip: !!isVip,
        isAdmin: user?.role === "admin",
      }),
    [materialsRaw, isVip, user?.role]
  );

  const categories = useMemo(() => {
    const set = new Set(materials.map((m) => m.category));
    return ["Todos", ...Array.from(set)];
  }, [materials]);

  const list = useMemo(
    () =>
      category === "Todos"
        ? materials
        : materials.filter((m) => m.category === category),
    [category, materials]
  );

  // Deep-link da notificação: mostra o item e rola até ele
  useEffect(() => {
    if (!focusId) return;
    const item = materials.find((m) => m.id === focusId);
    if (item) setCategory("Todos");
    const t = window.setTimeout(() => {
      document
        .getElementById(`material-${focusId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 180);
    return () => window.clearTimeout(t);
  }, [focusId, materials]);

  // Se a categoria sumiu (material removido), volta para Todos
  useEffect(() => {
    if (category !== "Todos" && !categories.includes(category)) {
      setCategory("Todos");
    }
  }, [category, categories]);

  function handleDownload(
    id: string,
    title: string,
    locked: boolean,
    url?: string | null
  ) {
    if (locked) {
      setToast("Material exclusivo VIP.");
      setTimeout(() => setToast(""), 2200);
      return;
    }
    // URL já redacted no list se free — se null, não abre nada sensível
    if (!url) {
      setToast("Link indisponível para o seu plano.");
      setTimeout(() => setToast(""), 2200);
      return;
    }
    recordDownload(id);
    window.open(url, "_blank", "noopener,noreferrer");
    setToast(`Abrindo: ${title}`);
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

      {materials.length > 0 && (
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
      )}

      {toast && (
        <div className="mb-4 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700 shadow-sm">
          {toast}
        </div>
      )}

      {list.length === 0 ? (
        <EmptyState
          icon={<Books size={28} weight="duotone" />}
          title="Nenhum material ainda"
          description={
            user?.role === "admin"
              ? "Crie materiais oficiais no Painel ADM → aba Materiais."
              : "Em breve o staff publicará templates, checklists e guias aqui."
          }
          action={
            user?.role === "admin" ? (
              <Link href="/app/admin">
                <Button size="sm">Abrir Painel ADM</Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {list.map((m) => {
            const Icon = typeIcon[m.type];
            const locked = m.vipOnly && !isVip;
            const focused = focusId === m.id;
            return (
              <div
                key={m.id}
                id={`material-${m.id}`}
                className={
                  focused
                    ? "card-interactive flex scroll-mt-24 flex-col gap-4 rounded-2xl border-2 border-rose-400 bg-white p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04)] ring-2 ring-rose-300/50 sm:flex-row sm:items-center"
                    : "card-interactive flex scroll-mt-24 flex-col gap-4 rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04)] sm:flex-row sm:items-center"
                }
              >
                <div className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#1f1f1f] text-white">
                  <Icon size={20} weight="fill" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-semibold text-black">
                      {m.title}
                    </h2>
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
                    onClick={() =>
                      handleDownload(m.id, m.title, locked, m.url)
                    }
                  >
                    <DownloadSimple size={16} weight="bold" />
                    {m.type === "link" || m.url ? "Abrir" : "Baixar"}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
