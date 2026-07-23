"use client";

import { EmptyState } from "@/components/empty-state";
import { ProfileHoverCard } from "@/components/profile-hover-card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TagList } from "@/components/tag-chips";
import { VerifiedBadge } from "@/components/verified-badge";
import { useAuth } from "@/hooks/use-auth";
import { useAuthStore } from "@/lib/auth-store";
import { useBlockStore } from "@/lib/block-store";
import { computeMentorshipMatches } from "@/lib/match";
import type { MentorshipMatch } from "@/lib/match";
import {
  ArrowRight,
  Briefcase,
  ChatsCircle,
  CheckCircle,
  GraduationCap,
  Handshake,
  Lightning,
  SlidersHorizontal,
  Sparkle,
  Student,
  UserFocus,
  UsersThree,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useMemo, useState } from "react";

type RoleFilter = "all" | "mentor" | "mentee" | "peer";

export default function MentorshipPage() {
  const { user } = useAuth();
  const users = useAuthStore((s) => s.users);
  const isEitherBlocked = useBlockStore((s) => s.isEitherBlocked);
  const blocks = useBlockStore((s) => s.blocks);

  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");

  const matches = useMemo(() => {
    if (!user) return [];
    return computeMentorshipMatches(user, users, 16).filter(
      (m) => !isEitherBlocked(user.id, m.user.id)
    );
  }, [user, users, isEitherBlocked, blocks]);

  const filteredMatches = useMemo(() => {
    if (roleFilter === "all") return matches;
    if (roleFilter === "mentor") return matches.filter((m) => m.role === "mentor");
    if (roleFilter === "mentee") return matches.filter((m) => m.role === "mentee");
    if (roleFilter === "peer") return matches.filter((m) => m.role === "peer");
    return matches;
  }, [matches, roleFilter]);

  if (!user) return null;

  const needsSetup =
    user.interests.length === 0 &&
    user.goals.length === 0 &&
    !user.seekingMentorship &&
    !user.offeringMentorship;

  // Profile completion score
  const profileScore =
    (user.interests.length > 0 ? 30 : 0) +
    (user.goals.length > 0 ? 30 : 0) +
    (user.seekingMentorship || user.offeringMentorship ? 40 : 0);

  return (
    <div className="app-page mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      {/* Header Section */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-200/80 bg-sky-50/80 px-3 py-1 text-[12px] font-semibold text-sky-900 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-300 mb-3">
            <Handshake size={15} weight="fill" />
            Mentoria & Networking Inteligente
          </div>
          <h1 className="font-display text-[1.75rem] font-semibold tracking-tight text-[#1f1f1f] dark:text-zinc-50 sm:text-[2.25rem]">
            Match de Mentorias
          </h1>
          <p className="mt-2 max-w-[55ch] text-[14px] leading-relaxed text-neutral-500 dark:text-zinc-400">
            Conectamos você com mentores, mentorados e parceiros com base nos seus interesses e objetivos. Quanto mais completo seu perfil, mais precisos são os matches.
          </p>
        </div>
      </div>

      {/* Profile Mentorship Status Card */}
      <div className="mb-8 overflow-hidden rounded-3xl border border-neutral-200/90 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-[#141414]">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3 min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 text-neutral-800 dark:bg-zinc-800 dark:text-zinc-200">
                <SlidersHorizontal size={16} weight="bold" />
              </span>
              <div>
                <h3 className="font-display text-sm font-semibold text-[#1f1f1f] dark:text-zinc-100">
                  Seu Perfil de Mentoria
                </h3>
                <p className="text-xs text-neutral-500 dark:text-zinc-400">
                  Status de disponibilidade para conexões na comunidade
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {user.seekingMentorship && (
                <Badge variant="outline" className="gap-1 bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800">
                  <Student size={13} weight="bold" />
                  Buscando Mentoria
                </Badge>
              )}
              {user.offeringMentorship && (
                <Badge variant="vip" className="gap-1">
                  <UserFocus size={13} weight="bold" />
                  Oferecendo Mentoria
                </Badge>
              )}
              {!user.seekingMentorship && !user.offeringMentorship && (
                <span className="text-xs text-neutral-500 italic">
                  Você ainda não ativou a busca nem oferta de mentoria.
                </span>
              )}
            </div>

            {user.interests.length > 0 && (
              <div className="pt-1">
                <TagList tags={user.interests} />
              </div>
            )}

            {user.goals.length > 0 && (
              <ul className="space-y-1 pt-1">
                {user.goals.map((g) => (
                  <li
                    key={g}
                    className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-zinc-400"
                  >
                    <ArrowRight size={11} className="shrink-0 text-neutral-400" />
                    <span>{g}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-col items-start sm:items-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-neutral-100 dark:border-zinc-800">
            {/* Optimization Progress bar */}
            <div className="w-full sm:w-44 space-y-1">
              <div className="flex justify-between text-[11px] font-semibold text-neutral-600 dark:text-zinc-300">
                <span>Otimização</span>
                <span className="font-mono">{profileScore}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-zinc-800">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    profileScore >= 80 ? "bg-emerald-500" : "bg-amber-500"
                  }`}
                  style={{ width: `${profileScore}%` }}
                />
              </div>
            </div>

            <Link href="/app/profile">
              <Button variant="outline" size="sm" className="rounded-full text-xs">
                Editar interesses e objetivos <ArrowRight size={12} className="ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Setup Prompt Banner */}
      {needsSetup && (
        <div className="mb-8 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-amber-200/80 bg-amber-50/80 p-5 dark:border-amber-900/50 dark:bg-amber-950/30">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400 text-neutral-950">
              <Sparkle size={20} weight="fill" />
            </div>
            <div>
              <h4 className="font-display text-sm font-semibold text-amber-900 dark:text-amber-200">
                Complete seu perfil para liberar mais matches
              </h4>
              <p className="text-xs text-amber-800/80 dark:text-amber-300/80">
                Adicione suas áreas de interesse, objetivos e se busca ou oferece mentoria para nosso algoritmo encontrar conexões ideais.
              </p>
            </div>
          </div>
          <Link href="/app/profile" className="shrink-0">
            <Button size="sm" className="rounded-full bg-amber-400 font-semibold text-neutral-950 hover:bg-amber-300">
              Preencher perfil
            </Button>
          </Link>
        </div>
      )}

      {/* Role Filter Toolbar */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-display text-base font-semibold tracking-tight text-[#1f1f1f] dark:text-zinc-50">
          Conexões Sugeridas ({filteredMatches.length})
        </h2>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setRoleFilter("all")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-medium transition-all ${
              roleFilter === "all"
                ? "bg-[#1f1f1f] text-white shadow-sm dark:bg-zinc-100 dark:text-[#141414]"
                : "bg-neutral-100/80 text-neutral-600 hover:bg-neutral-200/80 dark:bg-zinc-800/80 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            Todos
          </button>

          <button
            type="button"
            onClick={() => setRoleFilter("mentor")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-medium transition-all ${
              roleFilter === "mentor"
                ? "bg-[#1f1f1f] text-white shadow-sm dark:bg-zinc-100 dark:text-[#141414]"
                : "bg-neutral-100/80 text-neutral-600 hover:bg-neutral-200/80 dark:bg-zinc-800/80 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            <UserFocus size={14} weight="bold" className="text-amber-500" />
            Mentores
          </button>

          <button
            type="button"
            onClick={() => setRoleFilter("mentee")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-medium transition-all ${
              roleFilter === "mentee"
                ? "bg-[#1f1f1f] text-white shadow-sm dark:bg-zinc-100 dark:text-[#141414]"
                : "bg-neutral-100/80 text-neutral-600 hover:bg-neutral-200/80 dark:bg-zinc-800/80 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            <Student size={14} weight="bold" className="text-sky-500" />
            Mentorados
          </button>

          <button
            type="button"
            onClick={() => setRoleFilter("peer")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-medium transition-all ${
              roleFilter === "peer"
                ? "bg-[#1f1f1f] text-white shadow-sm dark:bg-zinc-100 dark:text-[#141414]"
                : "bg-neutral-100/80 text-neutral-600 hover:bg-neutral-200/80 dark:bg-zinc-800/80 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            <UsersThree size={14} weight="bold" className="text-emerald-500" />
            Peers
          </button>
        </div>
      </div>

      {/* Match Cards List */}
      {filteredMatches.length === 0 ? (
        <EmptyState
          icon={<Handshake size={28} weight="duotone" />}
          title={
            roleFilter !== "all"
              ? "Nenhum match nesta categoria"
              : "Nenhum match encontrado ainda"
          }
          description={
            roleFilter !== "all"
              ? "Tente selecionar outra opção de filtro."
              : "Adicione mais interesses e objetivos no seu perfil para encontrar mentores e conexões."
          }
          action={
            roleFilter !== "all" ? (
              <Button variant="outline" onClick={() => setRoleFilter("all")}>
                Ver todos os matches
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-4">
          {filteredMatches.map((m) => (
            <article
              key={m.user.id}
              className="group relative flex flex-col justify-between gap-5 rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-md dark:border-zinc-800 dark:bg-[#141414] dark:hover:border-zinc-700 sm:flex-row sm:items-center"
            >
              <div className="flex items-start gap-4 min-w-0 flex-1">
                <ProfileHoverCard
                  userId={m.user.id}
                  fallback={{
                    name: m.user.name,
                    avatarUrl: m.user.avatarUrl,
                    isVerified: m.user.isVerified,
                    isVip: m.user.isVip,
                    avatarFrame: m.user.avatarFrame,
                    username: m.user.username,
                    bio: m.user.bio,
                  }}
                >
                  <Link
                    href={`/app/u/${m.user.id}`}
                    className="avatar-link shrink-0 transition-transform group-hover:scale-105"
                  >
                    <Avatar
                      name={m.user.name}
                      src={m.user.avatarUrl}
                      size="lg"
                      frame={m.user.isVip ? m.user.avatarFrame : null}
                    />
                  </Link>
                </ProfileHoverCard>

                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <ProfileHoverCard
                      userId={m.user.id}
                      fallback={{
                        name: m.user.name,
                        avatarUrl: m.user.avatarUrl,
                        isVerified: m.user.isVerified,
                        isVip: m.user.isVip,
                        avatarFrame: m.user.avatarFrame,
                        username: m.user.username,
                        bio: m.user.bio,
                      }}
                    >
                      <Link
                        href={`/app/u/${m.user.id}`}
                        className="inline-flex items-center gap-1 font-display text-base font-semibold text-[#1f1f1f] hover:underline dark:text-zinc-50"
                      >
                        {m.user.name}
                        {m.user.isVerified && <VerifiedBadge size={15} />}
                      </Link>
                    </ProfileHoverCard>

                    {m.role === "mentor" && <Badge variant="vip">Mentor</Badge>}
                    {m.role === "mentee" && <Badge variant="outline">Mentorado</Badge>}
                    {m.role === "peer" && <Badge variant="outline">Peer</Badge>}

                    {/* Match Score Badge */}
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-bold font-mono text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
                      <Lightning size={12} weight="fill" className="text-amber-500" />
                      {m.score}% Match
                    </span>
                  </div>

                  <p className="flex items-start gap-1.5 text-xs text-neutral-600 dark:text-zinc-300 leading-relaxed">
                    <Sparkle size={13} className="shrink-0 text-sky-500 mt-0.5" />
                    <span>{m.reason}</span>
                  </p>

                  {m.sharedInterests.length > 0 && (
                    <div className="pt-1">
                      <TagList tags={m.sharedInterests} />
                    </div>
                  )}

                  {m.user.goals[0] && (
                    <p className="text-[11px] text-neutral-400 dark:text-zinc-500 truncate pt-0.5">
                      Objetivo principal: {m.user.goals[0]}
                    </p>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex shrink-0 items-center sm:flex-col sm:items-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-neutral-100 dark:border-zinc-800">
                <Link href={`/app/chat?dm=${encodeURIComponent(m.user.id)}`} className="flex-1 sm:flex-initial">
                  <Button size="sm" variant="outline" className="w-full rounded-full">
                    <ChatsCircle size={15} weight="bold" className="mr-1.5 text-sky-500" />
                    Conversar
                  </Button>
                </Link>
                <Link href={`/app/u/${m.user.id}`} className="flex-1 sm:flex-initial">
                  <Button size="sm" className="w-full rounded-full">
                    Ver perfil
                  </Button>
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

