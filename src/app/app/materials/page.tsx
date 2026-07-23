"use client";

import { EmptyState } from "@/components/empty-state";
import { MaterialDropTimer } from "@/components/material-drop-timer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VipBadge } from "@/components/vip-gate";
import { useAuth } from "@/hooks/use-auth";
import { redactMaterialsForViewer } from "@/lib/access-control";
import {
  hydrateMaterialsFromServer,
  useMaterialStore,
} from "@/lib/material-store";
import { formatDate } from "@/lib/utils";
import {
  ArrowSquareOut,
  Books,
  CheckCircle,
  Clock,
  CrownSimple,
  DownloadSimple,
  FilePdf,
  FileText,
  Flame,
  FolderSimple,
  GraduationCap,
  Link as LinkIcon,
  Lock,
  MagnifyingGlass,
  Sparkle,
  SquaresFour,
  Storefront,
  TrendUp,
  X,
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

const typeColorClass = {
  pdf: "bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400",
  template: "bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400",
  checklist: "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400",
  link: "bg-sky-500/10 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400",
  course: "bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400",
} as const;

type FormatFilter = "all" | "pdf" | "template" | "checklist" | "link" | "course";

export default function MaterialsPage() {
  const { isVip, user } = useAuth();
  const searchParams = useSearchParams();
  const focusId = searchParams.get("id");
  const materialsRaw = useMaterialStore((s) => s.materials);
  const recordDownload = useMaterialStore((s) => s.recordDownload);

  const [searchQuery, setSearchQuery] = useState("");
  const [formatFilter, setFormatFilter] = useState<FormatFilter>("all");
  const [selectedCategory, setSelectedCategory] = useState("Todos");
  const [toast, setToast] = useState("");

  useEffect(() => {
    void hydrateMaterialsFromServer();
  }, []);

  // AppSec: free nunca recebe URL de material VIP no React tree
  const materials = useMemo(
    () =>
      redactMaterialsForViewer(materialsRaw, {
        isVip: !!isVip,
        isAdmin: user?.role === "admin",
      }),
    [materialsRaw, isVip, user?.role]
  );

  // Spotlight top drop (most downloaded or first material)
  const spotlightMaterial = useMemo(() => {
    if (materials.length === 0) return null;
    const sorted = [...materials].sort((a, b) => b.downloads - a.downloads);
    return sorted[0];
  }, [materials]);

  const categories = useMemo(() => {
    const set = new Set(materials.map((m) => m.category));
    return ["Todos", ...Array.from(set)];
  }, [materials]);

  const filteredMaterials = useMemo(() => {
    return materials.filter((m) => {
      const matchesSearch =
        searchQuery.trim() === "" ||
        m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.category.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (formatFilter !== "all" && m.type !== formatFilter) return false;
      if (selectedCategory !== "Todos" && m.category !== selectedCategory) return false;

      return true;
    });
  }, [materials, searchQuery, formatFilter, selectedCategory]);

  // Deep-link da notificação: mostra o item e rola até ele
  useEffect(() => {
    if (!focusId) return;
    const item = materials.find((m) => m.id === focusId);
    if (item) {
      setSelectedCategory("Todos");
      setFormatFilter("all");
    }
    const t = window.setTimeout(() => {
      document
        .getElementById(`material-${focusId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 180);
    return () => window.clearTimeout(t);
  }, [focusId, materials]);

  function handleDownload(
    id: string,
    title: string,
    locked: boolean,
    url?: string | null
  ) {
    if (locked) {
      setToast("🔒 Material exclusivo VIP. Faça upgrade para desbloquear!");
      setTimeout(() => setToast(""), 3000);
      return;
    }
    if (!url) {
      setToast("⚠️ Link indisponível para o seu plano.");
      setTimeout(() => setToast(""), 3000);
      return;
    }
    recordDownload(id);
    window.open(url, "_blank", "noopener,noreferrer");
    setToast(`⚡ Abrindo recurso: ${title}`);
    setTimeout(() => setToast(""), 3000);
  }

  return (
    <div className="app-page mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      {/* Header section */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-200/80 bg-amber-50/80 px-3 py-1 text-[12px] font-semibold text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300 mb-3">
            <Storefront size={15} weight="fill" />
            Marketplace de Recursos & Drops
          </div>
          <h1 className="font-display text-[1.75rem] font-semibold tracking-tight text-[#1f1f1f] dark:text-zinc-50 sm:text-[2.25rem]">
            Materiais & Ferramentas
          </h1>
          <p className="mt-2 max-w-[55ch] text-[14px] leading-relaxed text-neutral-500 dark:text-zinc-400">
            Templates, checklists, planilhas, PDFs, metodologias e ferramentas exclusivas publicadas pelo staff para acelerar seus resultados.
          </p>
        </div>

        {user?.role === "admin" && (
          <a
            href="https://panel.nullysh.com/materials"
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0"
          >
            <Button variant="outline" size="sm" className="rounded-full">
              Gerenciar no Painel ADM →
            </Button>
          </a>
        )}
      </div>

      {/* Enhanced Drop Timer Banner */}
      <MaterialDropTimer className="mb-8" />

      {/* Spotlight Drop Banner */}
      {!searchQuery && formatFilter === "all" && selectedCategory === "Todos" && spotlightMaterial && (
        <section className="mb-10">
          <div className="group relative overflow-hidden rounded-3xl border border-neutral-800/80 bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-800 p-6 text-white shadow-xl dark:border-zinc-800 dark:from-zinc-950 dark:to-zinc-900 sm:p-8">
            <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl" />
            <div className="pointer-events-none absolute -left-20 -bottom-20 h-72 w-72 rounded-full bg-rose-500/10 blur-3xl" />

            <div className="relative z-10 flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
              <div className="space-y-3 max-w-2xl">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-300 border border-amber-500/30">
                    <Flame size={13} weight="fill" /> Drop em Destaque
                  </span>
                  <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium text-neutral-200 backdrop-blur-sm uppercase">
                    {typeLabel[spotlightMaterial.type]}
                  </span>
                  {spotlightMaterial.vipOnly && (
                    <Badge variant="vip" className="bg-amber-400 text-neutral-950">
                      VIP
                    </Badge>
                  )}
                  <span className="text-xs text-neutral-400">
                    {spotlightMaterial.category}
                  </span>
                </div>

                <h2 className="font-display text-xl font-bold tracking-tight text-white sm:text-2xl">
                  {spotlightMaterial.title}
                </h2>
                <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed line-clamp-2">
                  {spotlightMaterial.description}
                </p>

                <div className="flex items-center gap-4 text-xs text-neutral-400 pt-1">
                  <span className="flex items-center gap-1">
                    <TrendUp size={14} className="text-amber-400" />
                    <strong className="text-white">{spotlightMaterial.downloads.toLocaleString("pt-BR")}</strong> downloads
                  </span>
                  {spotlightMaterial.size && (
                    <span>· Tamanho: <strong className="text-white">{spotlightMaterial.size}</strong></span>
                  )}
                  <span>· Publicado em {formatDate(spotlightMaterial.createdAt)}</span>
                </div>
              </div>

              <div className="shrink-0">
                {spotlightMaterial.vipOnly && !isVip ? (
                  <Link href="/pricing">
                    <Button className="h-11 rounded-full bg-amber-400 px-6 font-semibold text-neutral-950 transition-all hover:bg-amber-300 hover:scale-[1.02]">
                      <Lock size={16} weight="bold" className="mr-1.5" />
                      Desbloquear com VIP
                    </Button>
                  </Link>
                ) : (
                  <Button
                    onClick={() =>
                      handleDownload(
                        spotlightMaterial.id,
                        spotlightMaterial.title,
                        spotlightMaterial.vipOnly && !isVip,
                        spotlightMaterial.url
                      )
                    }
                    className="h-11 rounded-full bg-white px-6 font-semibold text-neutral-950 transition-all hover:bg-neutral-100 hover:scale-[1.02] shadow-md dark:bg-zinc-100 dark:text-neutral-900"
                  >
                    <DownloadSimple size={18} weight="bold" className="mr-1.5" />
                    {spotlightMaterial.type === "link" || spotlightMaterial.url ? "Abrir Recurso" : "Baixar Agora"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Floating Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border border-neutral-800 bg-neutral-950 p-4 text-sm font-medium text-white shadow-2xl animate-in fade-in slide-in-from-bottom-5">
          <Sparkle size={18} weight="fill" className="text-amber-400" />
          <span>{toast}</span>
        </div>
      )}

      {/* Toolbar: Search, Format Pills & Category Tabs */}
      <div className="mb-8 space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Search input */}
          <div className="relative flex-1 max-w-md">
            <MagnifyingGlass
              size={18}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-zinc-500"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por template, PDF, ferramenta ou estratégia..."
              className="h-11 w-full rounded-2xl border border-neutral-200 bg-white pl-10 pr-9 text-sm text-[#1f1f1f] placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 dark:border-zinc-800 dark:bg-[#141414] dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-700 dark:focus:ring-zinc-100/10 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Format Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setFormatFilter("all")}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-medium transition-all ${
                formatFilter === "all"
                  ? "bg-[#1f1f1f] text-white shadow-sm dark:bg-zinc-100 dark:text-[#141414]"
                  : "bg-neutral-100/80 text-neutral-600 hover:bg-neutral-200/80 dark:bg-zinc-800/80 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
            >
              Todos ({materials.length})
            </button>

            <button
              type="button"
              onClick={() => setFormatFilter("pdf")}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-medium transition-all ${
                formatFilter === "pdf"
                  ? "bg-[#1f1f1f] text-white shadow-sm dark:bg-zinc-100 dark:text-[#141414]"
                  : "bg-neutral-100/80 text-neutral-600 hover:bg-neutral-200/80 dark:bg-zinc-800/80 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
            >
              <FilePdf size={14} weight="fill" className="text-rose-500" />
              PDFs
            </button>

            <button
              type="button"
              onClick={() => setFormatFilter("template")}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-medium transition-all ${
                formatFilter === "template"
                  ? "bg-[#1f1f1f] text-white shadow-sm dark:bg-zinc-100 dark:text-[#141414]"
                  : "bg-neutral-100/80 text-neutral-600 hover:bg-neutral-200/80 dark:bg-zinc-800/80 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
            >
              <SquaresFour size={14} weight="fill" className="text-purple-500" />
              Templates
            </button>

            <button
              type="button"
              onClick={() => setFormatFilter("checklist")}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-medium transition-all ${
                formatFilter === "checklist"
                  ? "bg-[#1f1f1f] text-white shadow-sm dark:bg-zinc-100 dark:text-[#141414]"
                  : "bg-neutral-100/80 text-neutral-600 hover:bg-neutral-200/80 dark:bg-zinc-800/80 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
            >
              <FileText size={14} weight="fill" className="text-emerald-500" />
              Checklists
            </button>

            <button
              type="button"
              onClick={() => setFormatFilter("link")}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-medium transition-all ${
                formatFilter === "link"
                  ? "bg-[#1f1f1f] text-white shadow-sm dark:bg-zinc-100 dark:text-[#141414]"
                  : "bg-neutral-100/80 text-neutral-600 hover:bg-neutral-200/80 dark:bg-zinc-800/80 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
            >
              <LinkIcon size={14} weight="bold" className="text-sky-500" />
              Links & Tools
            </button>
          </div>
        </div>

        {/* Category Pills Bar */}
        {categories.length > 1 && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-neutral-100 dark:border-zinc-800">
            <span className="text-xs font-semibold text-neutral-400 dark:text-zinc-500 uppercase tracking-wider mr-1">
              Categorias:
            </span>
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setSelectedCategory(c)}
                className={
                  selectedCategory === c
                    ? "rounded-lg bg-neutral-200 px-3 py-1 text-xs font-semibold text-neutral-900 dark:bg-zinc-700 dark:text-white"
                    : "rounded-lg bg-neutral-100/60 px-3 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-200/60 dark:bg-zinc-800/60 dark:text-zinc-400 dark:hover:bg-zinc-800"
                }
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Marketplace Product Grid */}
      {filteredMaterials.length === 0 ? (
        <EmptyState
          icon={<Books size={28} weight="duotone" />}
          title={
            searchQuery
              ? `Nenhum material encontrado para "${searchQuery}"`
              : "Nenhum material disponível nesta categoria"
          }
          description={
            searchQuery
              ? "Tente verificar os termos de busca ou remover os filtros."
              : user?.role === "admin"
              ? "Crie materiais no Nullysh Panel para disponibilizá-los aqui."
              : "O staff ainda não publicou drops nesta categoria. Volte em breve!"
          }
          action={
            searchQuery || formatFilter !== "all" || selectedCategory !== "Todos" ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSearchQuery("");
                  setFormatFilter("all");
                  setSelectedCategory("Todos");
                }}
              >
                Limpar filtros
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredMaterials.map((m) => {
            const Icon = typeIcon[m.type];
            const colorClass = typeColorClass[m.type];
            const locked = m.vipOnly && !isVip;
            const focused = focusId === m.id;

            return (
              <div
                key={m.id}
                id={`material-${m.id}`}
                className={
                  focused
                    ? "group relative flex flex-col justify-between rounded-2xl border-2 border-amber-400 bg-white p-5 shadow-lg ring-2 ring-amber-300/50 dark:border-amber-500 dark:bg-[#141414] transition-all duration-200 scroll-mt-24"
                    : "group relative flex flex-col justify-between rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-neutral-300 hover:shadow-md dark:border-zinc-800 dark:bg-[#141414] dark:hover:border-zinc-700 scroll-mt-24"
                }
              >
                <div>
                  {/* Top Bar: Icon, Format & Category */}
                  <div className="flex items-start justify-between gap-3">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-xl font-bold transition-transform group-hover:scale-105 ${colorClass}`}>
                      <Icon size={22} weight="fill" />
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      <span className="rounded-md bg-neutral-100 dark:bg-zinc-800 px-2 py-0.5 text-[10px] font-bold uppercase text-neutral-600 dark:text-zinc-400">
                        {typeLabel[m.type]}
                      </span>
                      {m.vipOnly && <VipBadge />}
                    </div>
                  </div>

                  {/* Title & Description */}
                  <h3 className="mt-4 font-display text-base font-semibold tracking-tight text-[#1f1f1f] dark:text-zinc-50 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                    {m.title}
                  </h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-neutral-600 dark:text-zinc-400 line-clamp-2">
                    {m.description}
                  </p>
                </div>

                {/* Card Stats Footer & CTA */}
                <div className="mt-6 pt-3 border-t border-neutral-100 dark:border-zinc-800/80">
                  <div className="mb-3 flex items-center justify-between text-[11px] font-medium text-neutral-500 dark:text-zinc-400">
                    <span className="flex items-center gap-1">
                      <TrendUp size={13} className="text-amber-500" />
                      {m.downloads.toLocaleString("pt-BR")} downloads
                    </span>
                    <span>{m.size || m.category}</span>
                  </div>

                  {locked ? (
                    <Link href="/pricing" className="block w-full">
                      <Button variant="outline" className="w-full justify-center rounded-xl border-amber-300 bg-amber-50/50 text-amber-900 hover:bg-amber-100 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
                        <Lock size={14} weight="bold" className="mr-1.5" />
                        Liberar com VIP
                      </Button>
                    </Link>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => handleDownload(m.id, m.title, locked, m.url)}
                      className="w-full justify-center rounded-xl transition-all hover:bg-neutral-900 hover:text-white dark:hover:bg-zinc-100 dark:hover:text-neutral-900"
                    >
                      {m.type === "link" || m.url ? (
                        <>
                          <ArrowSquareOut size={16} weight="bold" className="mr-1.5" />
                          Abrir Recurso
                        </>
                      ) : (
                        <>
                          <DownloadSimple size={16} weight="bold" className="mr-1.5" />
                          Baixar Material
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

