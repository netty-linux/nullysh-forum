"use client";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TagList } from "@/components/tag-chips";
import { VerifiedBadge } from "@/components/verified-badge";
import { useAuth } from "@/hooks/use-auth";
import { useAuthStore } from "@/lib/auth-store";
import { useBlockStore } from "@/lib/block-store";
import { computeMentorshipMatches } from "@/lib/match";
import {
  ChatsCircle,
  Handshake,
  Student,
  UserFocus,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useMemo } from "react";

export default function MentorshipPage() {
  const { user } = useAuth();
  const users = useAuthStore((s) => s.users);
  const isEitherBlocked = useBlockStore((s) => s.isEitherBlocked);
  const blocks = useBlockStore((s) => s.blocks);

  const matches = useMemo(() => {
    if (!user) return [];
    return computeMentorshipMatches(user, users, 16).filter(
      (m) => !isEitherBlocked(user.id, m.user.id)
    );
  }, [user, users, isEitherBlocked, blocks]);

  if (!user) return null;

  const needsSetup =
    user.interests.length === 0 &&
    user.goals.length === 0 &&
    !user.seekingMentorship &&
    !user.offeringMentorship;

  return (
    <div className="app-page mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <Handshake size={22} weight="bold" className="text-[#1f1f1f]" />
          <h1 className="text-2xl font-semibold tracking-tight text-[#1f1f1f] sm:text-3xl">
            Match de mentorias
          </h1>
        </div>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-neutral-500">
          Conectamos você com mentores e mentorados com base em interesses e
          objetivos. Quanto mais completo o perfil, melhor o match.
        </p>
      </div>

      {/* Seu status */}
      <div className="mb-6 rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
          Seu perfil de mentoria
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {user.seekingMentorship && (
            <Badge variant="outline">
              <Student size={12} className="mr-1" weight="bold" />
              Buscando mentoria
            </Badge>
          )}
          {user.offeringMentorship && (
            <Badge variant="vip">
              <UserFocus size={12} className="mr-1" weight="bold" />
              Oferecendo mentoria
            </Badge>
          )}
          {!user.seekingMentorship && !user.offeringMentorship && (
            <span className="text-sm text-neutral-500">
              Você ainda não ativou busca nem oferta de mentoria.
            </span>
          )}
        </div>
        {user.interests.length > 0 && (
          <div className="mt-3">
            <TagList tags={user.interests} />
          </div>
        )}
        {user.goals.length > 0 && (
          <ul className="mt-3 space-y-1">
            {user.goals.map((g) => (
              <li
                key={g}
                className="text-sm leading-relaxed text-neutral-600 before:mr-1.5 before:text-neutral-300 before:content-['→']"
              >
                {g}
              </li>
            ))}
          </ul>
        )}
        <Link href="/app/profile" className="mt-4 inline-block">
          <Button variant="outline" size="sm">
            Editar interesses e objetivos
          </Button>
        </Link>
      </div>

      {needsSetup && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          Preencha interesses, objetivos e se você busca ou oferece mentoria no
          perfil para liberar matches melhores.
        </div>
      )}

      <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.1em] text-[#1f1f1f]">
        Suas conexões sugeridas
      </h2>

      <div className="space-y-3">
        {matches.map((m) => (
          <article
            key={m.user.id}
            className="card-interactive flex flex-col gap-4 rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04)] sm:flex-row sm:items-center"
          >
            <Link href={`/app/u/${m.user.id}`} className="avatar-link shrink-0">
              <Avatar
                name={m.user.name}
                src={m.user.avatarUrl}
                size="lg"
                frame={m.user.isVip ? m.user.avatarFrame : null}
              />
            </Link>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <Link
                  href={`/app/u/${m.user.id}`}
                  className="inline-flex items-center gap-1 text-base font-semibold text-[#1f1f1f] hover:underline"
                >
                  {m.user.name}
                  {m.user.isVerified && <VerifiedBadge size={15} />}
                </Link>
                {m.role === "mentor" && (
                  <Badge variant="vip">Mentor</Badge>
                )}
                {m.role === "mentee" && (
                  <Badge variant="outline">Mentorado</Badge>
                )}
                {m.role === "peer" && (
                  <Badge variant="outline">Peer</Badge>
                )}
              </div>
              <p className="mt-1 text-sm text-neutral-600">{m.reason}</p>
              {m.sharedInterests.length > 0 && (
                <div className="mt-2">
                  <TagList tags={m.sharedInterests} />
                </div>
              )}
              {m.user.goals[0] && (
                <p className="mt-2 text-xs text-neutral-400">
                  Objetivo: {m.user.goals[0]}
                </p>
              )}
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:items-end">
              <span className="text-[11px] font-medium tabular-nums text-neutral-400">
                score {m.score}
              </span>
              <Link href={`/app/chat?dm=${encodeURIComponent(m.user.id)}`}>
                <Button size="sm" variant="outline">
                  <ChatsCircle size={16} weight="bold" />
                  Conversar
                </Button>
              </Link>
              <Link href={`/app/u/${m.user.id}`}>
                <Button size="sm">Ver perfil</Button>
              </Link>
            </div>
          </article>
        ))}

        {matches.length === 0 && (
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-12 text-center text-sm text-neutral-500">
            Nenhum match ainda. Adicione interesses e objetivos no perfil.
          </div>
        )}
      </div>
    </div>
  );
}
