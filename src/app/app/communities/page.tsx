"use client";

import { CreateCommunityModal } from "@/components/create-community-modal";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { VipBadge } from "@/components/vip-gate";
import { useAuth } from "@/hooks/use-auth";
import { countPostsInCommunity } from "@/lib/community-hashtags";
import { useCommunityStore } from "@/lib/community-store";
import { useForumStore } from "@/lib/forum-store";
import type { Community } from "@/lib/types";
import { COMPOSE_OPEN_EVENT } from "@/components/compose-fab";
import {
  ArrowRight,
  ChartLineUp,
  Check,
  Code,
  Copy,
  CrownSimple,
  Flame,
  Funnel,
  Hash,
  Heart,
  House,
  Lightbulb,
  Lightning,
  Lock,
  MagnifyingGlass,
  Megaphone,
  Palette,
  Plus,
  Robot,
  Rocket,
  SealCheck,
  Sparkle,
  Star,
  TrendUp,
  UsersThree,
  X,
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

type FilterTab = "all" | "trending" | "staff" | "vip";

export default function CommunitiesPage() {
  const { user, isVip } = useAuth();
  const communities = useCommunityStore((s) => s.communities);
  const posts = useForumStore((s) => s.posts);
  const router = useRouter();

  const [createOpen, setCreateOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [copiedTag, setCopiedTag] = useState<string | null>(null);

  const postCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of communities) {
      map.set(c.id, countPostsInCommunity(posts, c));
    }
    return map;
  }, [communities, posts]);

  // Trending communities (sorted by post counts)
  const trendingCommunities = useMemo(() => {
    return [...communities]
      .sort((a, b) => (postCounts.get(b.id) ?? 0) - (postCounts.get(a.id) ?? 0))
      .slice(0, 2);
  }, [communities, postCounts]);

  // Filtered communities based on search and tab
  const filteredCommunities = useMemo(() => {
    return communities.filter((c) => {
      const matchesSearch =
        searchQuery.trim() === "" ||
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.hashtag.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.description.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (activeTab === "staff") return c.source === "staff";
      if (activeTab === "vip") return c.source === "member" || c.vipOnly || c.access === "vip";
      if (activeTab === "trending") return (postCounts.get(c.id) ?? 0) > 0 || c.source === "staff";

      return true;
    });
  }, [communities, searchQuery, activeTab, postCounts]);

  const handleCopyTag = (hashtag: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(`#${hashtag}`);
    setCopiedTag(hashtag);
    setTimeout(() => setCopiedTag(null), 2000);
  };

  const handleComposeWithTag = (hashtag: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.dispatchEvent(
      new CustomEvent(COMPOSE_OPEN_EVENT, {
        detail: { initialText: `#${hashtag} ` },
      })
    );
  };

  return (
    <div className="app-page mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      {/* Header section */}
      <div className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-200/80 bg-sky-50/80 px-3 py-1 text-[12px] font-semibold text-sky-800 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-300 mb-3">
            <Sparkle size={13} weight="fill" />
            Central de Tópicos & Tendências
          </div>
          <h1 className="font-display text-[1.75rem] font-semibold tracking-tight text-[#1f1f1f] dark:text-zinc-50 sm:text-[2.25rem]">
            Assuntos
          </h1>
          <p className="mt-2 max-w-[55ch] text-[14px] leading-relaxed text-neutral-500 dark:text-zinc-400">
            Descubra os temas mais comentados do fórum. Publique usando a <span className="font-medium text-neutral-800 dark:text-zinc-200">#hashtag</span> de um assunto para sincronizar automaticamente.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {isVip ? (
            <Button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="h-10 rounded-full px-5 text-sm font-medium shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus size={16} weight="bold" />
              Criar assunto
            </Button>
          ) : (
            <Link href="/pricing">
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-full border-amber-300/80 bg-amber-50/50 px-5 text-sm font-medium text-amber-950 hover:bg-amber-100/60 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:bg-amber-900/40"
              >
                <CrownSimple size={15} weight="fill" className="text-amber-500" />
                VIP cria assuntos
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Search and Filters Toolbar */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
            placeholder="Buscar por nome, descrição ou #hashtag..."
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

        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-medium transition-all ${
              activeTab === "all"
                ? "bg-[#1f1f1f] text-white shadow-sm dark:bg-zinc-100 dark:text-[#141414]"
                : "bg-neutral-100/80 text-neutral-600 hover:bg-neutral-200/80 dark:bg-zinc-800/80 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            Todos ({communities.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("trending")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-medium transition-all ${
              activeTab === "trending"
                ? "bg-[#1f1f1f] text-white shadow-sm dark:bg-zinc-100 dark:text-[#141414]"
                : "bg-neutral-100/80 text-neutral-600 hover:bg-neutral-200/80 dark:bg-zinc-800/80 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            <Flame size={14} weight="fill" className="text-amber-500" />
            Em Alta
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("staff")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-medium transition-all ${
              activeTab === "staff"
                ? "bg-[#1f1f1f] text-white shadow-sm dark:bg-zinc-100 dark:text-[#141414]"
                : "bg-neutral-100/80 text-neutral-600 hover:bg-neutral-200/80 dark:bg-zinc-800/80 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            <SealCheck size={14} weight="fill" className="text-sky-500" />
            Oficiais
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("vip")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-medium transition-all ${
              activeTab === "vip"
                ? "bg-[#1f1f1f] text-white shadow-sm dark:bg-zinc-100 dark:text-[#141414]"
                : "bg-neutral-100/80 text-neutral-600 hover:bg-neutral-200/80 dark:bg-zinc-800/80 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            <CrownSimple size={14} weight="fill" className="text-amber-500" />
            Criadas por VIP
          </button>
        </div>
      </div>

      {/* Spotlight Section - Em Alta (Displayed when on 'all' or 'trending' tab without search query) */}
      {!searchQuery && (activeTab === "all" || activeTab === "trending") && trendingCommunities.length > 0 && (
        <section className="mb-10">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/10 text-amber-500">
              <TrendUp size={14} weight="bold" />
            </div>
            <h2 className="font-display text-sm font-semibold tracking-wide uppercase text-neutral-500 dark:text-zinc-400">
              Destaques em Alta
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {trendingCommunities.map((c) => (
              <TrendingSpotlightCard
                key={c.id}
                community={c}
                isVip={isVip}
                postCount={postCounts.get(c.id) ?? 0}
                onCopyTag={handleCopyTag}
                isCopied={copiedTag === c.hashtag}
                onCompose={handleComposeWithTag}
              />
            ))}
          </div>
        </section>
      )}

      {/* Main Grid Layout + Info Sidebar */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main Hub Grid (2 Cols on lg) */}
        <div className="lg:col-span-2">
          {filteredCommunities.length === 0 ? (
            <EmptyState
              icon={<UsersThree size={28} weight="duotone" />}
              title={
                searchQuery
                  ? `Nenhum assunto encontrado para "${searchQuery}"`
                  : "Nenhum assunto nesta categoria"
              }
              description={
                searchQuery
                  ? "Tente verificar a ortografia ou buscar por outros termos."
                  : "Tente alternar entre os filtros no menu acima."
              }
              action={
                searchQuery ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setSearchQuery("");
                      setActiveTab("all");
                    }}
                  >
                    Limpar filtros
                  </Button>
                ) : isVip ? (
                  <Button type="button" onClick={() => setCreateOpen(true)}>
                    <Plus size={16} weight="bold" />
                    Criar assunto
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {filteredCommunities.map((c) => (
                <CommunityCard
                  key={c.id}
                  community={c}
                  isVip={isVip}
                  postCount={postCounts.get(c.id) ?? 0}
                  onCopyTag={handleCopyTag}
                  isCopied={copiedTag === c.hashtag}
                />
              ))}
            </div>
          )}
        </div>

        {/* Sidebar Info & Guidance */}
        <div className="space-y-6">
          {/* How Hashtags Sync Box */}
          <div className="rounded-2xl border border-neutral-200/80 bg-neutral-50/80 p-5 dark:border-zinc-800/80 dark:bg-[#141414]/60">
            <div className="mb-3 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-900 text-white dark:bg-zinc-100 dark:text-neutral-900">
                <Hash size={16} weight="bold" />
              </div>
              <h3 className="font-display text-sm font-semibold text-[#1f1f1f] dark:text-zinc-100">
                Como funcionam os Assuntos?
              </h3>
            </div>
            <ul className="space-y-2.5 text-xs text-neutral-600 dark:text-zinc-400">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-neutral-200/80 text-[10px] font-bold text-neutral-800 dark:bg-zinc-800 dark:text-zinc-200">
                  1
                </span>
                <span>
                  Ao postar no feed, inclua a <strong className="font-semibold text-neutral-950 dark:text-zinc-200">#hashtag</strong> do assunto desejado no corpo do texto.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-neutral-200/80 text-[10px] font-bold text-neutral-800 dark:bg-zinc-800 dark:text-zinc-200">
                  2
                </span>
                <span>
                  O fórum sincroniza a publicação com o tópico em tempo real sem precisar trocar de página.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-neutral-200/80 text-[10px] font-bold text-neutral-800 dark:bg-zinc-800 dark:text-zinc-200">
                  3
                </span>
                <span>
                  Assuntos com selo VIP são protegidos e acessíveis exclusivamente para assinantes.
                </span>
              </li>
            </ul>
          </div>

          {/* Quick CTA box */}
          <div className="rounded-2xl border border-sky-100 bg-sky-50/50 p-5 dark:border-sky-900/30 dark:bg-sky-950/20">
            <div className="flex items-center gap-2 text-sky-900 dark:text-sky-200">
              <Lightbulb size={18} weight="fill" className="text-sky-500" />
              <h4 className="font-display text-sm font-semibold">Quer criar seu próprio Assunto?</h4>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-sky-800/80 dark:text-sky-300/80">
              Membros VIP podem dar nome a novas comunidades e definir se o acesso será público ou exclusivo para a comunidade VIP.
            </p>
            {!isVip && (
              <Link href="/pricing" className="mt-3 inline-block">
                <Button size="sm" variant="outline" className="rounded-full border-sky-300 bg-white text-xs text-sky-900 hover:bg-sky-50 dark:border-sky-800 dark:bg-sky-900/40 dark:text-sky-200 dark:hover:bg-sky-900/60">
                  Conhecer o VIP
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>

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

/** Card de Destaque / Spotlight */
function TrendingSpotlightCard({
  community: c,
  isVip,
  postCount,
  onCopyTag,
  isCopied,
  onCompose,
}: {
  community: Community;
  isVip: boolean;
  postCount: number;
  onCopyTag: (tag: string, e: React.MouseEvent) => void;
  isCopied: boolean;
  onCompose: (tag: string, e: React.MouseEvent) => void;
}) {
  const Icon = iconMap[c.icon as keyof typeof iconMap] ?? UsersThree;

  return (
    <div className="group relative flex flex-col justify-between rounded-2xl border border-neutral-200/90 bg-gradient-to-b from-white to-neutral-50/50 p-6 shadow-sm transition-all duration-200 hover:border-neutral-300 dark:border-zinc-800 dark:from-[#141414] dark:to-zinc-900/60 dark:hover:border-zinc-700">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#1f1f1f] text-white transition-transform duration-200 group-hover:scale-105 dark:bg-zinc-100 dark:text-[#141414]">
              <Icon size={20} weight="fill" />
            </div>
            <div>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                <Flame size={12} weight="fill" /> Em alta
              </span>
              <h3 className="font-display text-base font-semibold text-[#1f1f1f] dark:text-zinc-50">
                {c.name}
              </h3>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {c.source === "staff" && (
              <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-800 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-300">
                <SealCheck size={11} weight="fill" />
                Staff
              </span>
            )}
            {(c.vipOnly || c.access === "vip") && <VipBadge />}
          </div>
        </div>

        <p className="mt-3 text-xs sm:text-sm leading-relaxed text-neutral-600 dark:text-zinc-400 line-clamp-2">
          {c.description}
        </p>
      </div>

      <div className="mt-5 pt-4 border-t border-neutral-100 dark:border-zinc-800/80 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => onCopyTag(c.hashtag, e)}
            className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-100/70 px-2.5 py-1 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            title="Copiar #hashtag"
          >
            <Hash size={12} weight="bold" />
            {c.hashtag}
            {isCopied ? <Check size={11} className="text-emerald-500 ml-0.5" /> : <Copy size={11} className="ml-0.5 opacity-60" />}
          </button>
          <span className="text-xs text-neutral-400 font-medium">
            {postCount} {postCount === 1 ? "post" : "posts"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => onCompose(c.hashtag, e)}
            className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-800 hover:bg-neutral-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          >
            Postar com #{c.hashtag}
          </button>
          <Link
            href={`/app/communities/${c.slug}`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#1f1f1f] hover:underline dark:text-zinc-100"
          >
            Acessar <ArrowRight size={13} />
          </Link>
        </div>
      </div>
    </div>
  );
}

/** Card de Comunidade Padrão */
function CommunityCard({
  community: c,
  isVip,
  postCount,
  onCopyTag,
  isCopied,
}: {
  community: Community;
  isVip: boolean;
  postCount: number;
  onCopyTag: (tag: string, e: React.MouseEvent) => void;
  isCopied: boolean;
}) {
  const Icon = iconMap[c.icon as keyof typeof iconMap] ?? UsersThree;
  const locked = (c.vipOnly || c.access === "vip") && !isVip;

  return (
    <Link
      href={`/app/communities/${c.slug}`}
      className="card-interactive group relative flex flex-col justify-between rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition-all duration-200 hover:border-neutral-300 dark:border-zinc-800 dark:bg-[#141414] dark:hover:border-zinc-700"
    >
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-neutral-100 text-neutral-900 transition-transform duration-200 group-hover:scale-105 dark:bg-zinc-800 dark:text-zinc-100">
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

        <h2 className="mt-3 font-display text-base font-semibold tracking-tight text-[#1f1f1f] dark:text-zinc-50">
          {c.name}
        </h2>
        <p className="mt-1.5 text-xs sm:text-sm leading-relaxed text-neutral-600 dark:text-zinc-400 line-clamp-2">
          {c.description}
        </p>
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={(e) => onCopyTag(c.hashtag, e)}
            className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-semibold text-[#1f1f1f] transition-colors hover:bg-neutral-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            title="Clique para copiar hashtag"
          >
            <Hash size={12} weight="bold" />
            {c.hashtag}
            {isCopied ? (
              <Check size={11} className="text-emerald-500 ml-0.5" />
            ) : (
              <Copy size={11} className="ml-0.5 opacity-60" />
            )}
          </button>

          {c.source === "member" && c.creatorName && (
            <span className="text-[11px] text-neutral-400 truncate max-w-[120px]">
              por {c.creatorName}
            </span>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-3 text-xs font-medium tabular-nums text-neutral-500 dark:border-zinc-800/80">
          <span>
            {postCount} {postCount === 1 ? "post" : "posts"}
            {c.tagPolicy === "admin" ? " · admin posta" : ""}
          </span>

          {locked ? (
            <span className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
              <Lock size={12} weight="bold" />
              VIP lê
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 font-semibold text-neutral-700 group-hover:text-neutral-950 dark:text-zinc-400 dark:group-hover:text-zinc-100">
              Ver conversas <ArrowRight size={12} />
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

