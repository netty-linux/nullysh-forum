"use client";

import { BannerImage } from "@/components/gif-banner-editor";
import { MusicTrackPlayer } from "@/components/music-track-player";
import { PostCard } from "@/components/post-card";
import { ProfileEmblem } from "@/components/profile-emblem";
import { ProfileLinkIcon } from "@/components/profile-link-icon";
import { RichText } from "@/components/rich-text";
import { TagList } from "@/components/tag-chips";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VerifiedBadge } from "@/components/verified-badge";
import { useAuth } from "@/hooks/use-auth";
import { useAuthStore } from "@/lib/auth-store";
import { useBlockStore } from "@/lib/block-store";
import {
  computeBadgeStats,
  evaluateEmblems,
} from "@/lib/emblems";
import { useForumStore } from "@/lib/forum-store";
import { isGifDataUrl } from "@/lib/image";
import { useSocialStore } from "@/lib/social-store";
import { displayHost, formatDate, normalizeUrl } from "@/lib/utils";
import {
  ArrowLeft,
  ChatCircle,
  CrownSimple,
  GridFour,
  Headphones,
  PencilSimple,
  Prohibit,
  UserMinus,
  UserPlus,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";

type Tab = "posts" | "about";

export default function PublicProfilePage() {
  const params = useParams();
  const id = params.id as string;
  const profile = useAuthStore((s) => s.users.find((u) => u.id === id));
  const { user: me } = useAuth();
  const posts = useForumStore((s) => s.posts);
  const hasBlocked = useBlockStore((s) => s.hasBlocked);
  const isBlockedBy = useBlockStore((s) => s.isBlockedBy);
  const blockUser = useBlockStore((s) => s.blockUser);
  const unblockUser = useBlockStore((s) => s.unblockUser);
  const blocks = useBlockStore((s) => s.blocks);
  const follows = useSocialStore((s) => s.follows);
  const follow = useSocialStore((s) => s.follow);
  const unfollow = useSocialStore((s) => s.unfollow);
  const isFollowing = useSocialStore((s) => s.isFollowing);
  const followerCount = useSocialStore((s) => s.followerCount);
  const followingCount = useSocialStore((s) => s.followingCount);
  const [tab, setTab] = useState<Tab>("posts");
  const [blockError, setBlockError] = useState("");
  const [followError, setFollowError] = useState("");

  const isOwn = me?.id === id;
  // re-render quando grafo social muda
  void follows;
  const amFollowing = !!(me && !isOwn && isFollowing(me.id, id));
  const nFollowers = followerCount(id);
  const nFollowing = followingCount(id);

  // Quem me bloqueou: perfil “não encontrado”
  const blockedByThem =
    !!me && !isOwn && isBlockedBy(me.id, id);

  // Eu bloqueei: tela de blur + desbloquear
  const iBlockedThem =
    !!me && !isOwn && hasBlocked(me.id, id);

  // re-render quando blocks muda
  void blocks;

  const userPosts = useMemo(
    () =>
      posts
        .filter((p) => p.authorId === id)
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ),
    [posts, id]
  );

  const equippedEmblem = useMemo(() => {
    if (!profile) return null;
    const unlocked = evaluateEmblems(
      profile,
      computeBadgeStats(profile.id, posts)
    );
    const eq = profile.badgeEquipped;
    if (eq && unlocked.includes(eq)) return eq;
    // fallback: se tem VIP e nada equipado, não força — só o que escolheu
    return null;
  }, [profile, posts]);

  if (!profile || blockedByThem) {
    return (
      <div className="app-page mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-lg font-semibold tracking-tight text-[#1f1f1f] dark:text-zinc-100">
          Perfil não encontrado
        </p>
        <p className="mt-2 text-sm text-neutral-500">
          Este usuário não existe ou foi removido.
        </p>
        <Link href="/app" className="mt-6 inline-block">
          <Button variant="outline">Voltar ao feed</Button>
        </Link>
      </div>
    );
  }

  function onBlock() {
    if (!me) return;
    setBlockError("");
    const ok = confirm(
      `Bloquear ${profile!.name}? Vocês não verão posts um do outro, não poderão se mandar DM e o perfil ficará restrito.`
    );
    if (!ok) return;
    const res = blockUser(me.id, id);
    if (!res.ok) {
      setBlockError(res.error);
      return;
    }
    // Remove follows em ambas as direções
    unfollow(me.id, id);
    unfollow(id, me.id);
  }

  function onUnblock() {
    if (!me) return;
    setBlockError("");
    const res = unblockUser(me.id, id);
    if (!res.ok) setBlockError(res.error);
  }

  function onToggleFollow() {
    if (!me || isOwn) return;
    setFollowError("");
    if (amFollowing) {
      unfollow(me.id, id);
      return;
    }
    const res = follow(me.id, id);
    if (!res.ok) setFollowError(res.error);
  }

  // Eu bloqueei: blur + opção de desbloquear
  if (iBlockedThem) {
    return (
      <div className="app-page mx-auto max-w-[40rem] px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-5">
          <Link
            href="/app"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-neutral-500 transition-colors hover:text-[#1f1f1f]"
          >
            <ArrowLeft size={15} weight="bold" />
            Feed
          </Link>
        </div>

        <div className="relative overflow-hidden rounded-2xl border-2 border-[#1f1f1f]/15 bg-white shadow-lg dark:border-zinc-700 dark:bg-[#141414]">
          {/* Fake preview embaçado */}
          <div
            className="pointer-events-none select-none blur-md"
            aria-hidden
          >
            <div className="h-36 bg-gradient-to-br from-neutral-700 via-neutral-500 to-neutral-400 sm:h-44" />
            <div className="px-6 pb-10 pt-4">
              <div className="-mt-12 h-20 w-20 rounded-full bg-neutral-300 ring-4 ring-white dark:bg-zinc-700 dark:ring-[#141414]" />
              <div className="mt-3 h-6 w-40 rounded bg-neutral-200 dark:bg-zinc-700" />
              <div className="mt-2 h-4 w-24 rounded bg-neutral-100 dark:bg-zinc-800" />
              <div className="mt-4 space-y-2">
                <div className="h-3 w-full rounded bg-neutral-100 dark:bg-zinc-800" />
                <div className="h-3 w-4/5 rounded bg-neutral-100 dark:bg-zinc-800" />
              </div>
            </div>
          </div>

          {/* Overlay */}
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/75 px-6 py-10 backdrop-blur-md dark:bg-black/60">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border-2 border-[#1f1f1f] bg-white shadow-md dark:border-zinc-100 dark:bg-zinc-900">
              <Prohibit size={28} weight="bold" className="text-[#1f1f1f] dark:text-zinc-100" />
            </div>
            <h1 className="text-center text-lg font-bold tracking-tight text-[#1f1f1f] dark:text-zinc-50">
              Você bloqueou este perfil
            </h1>
            <p className="mt-2 max-w-sm text-center text-sm leading-relaxed text-neutral-600 dark:text-zinc-400">
              <span className="font-semibold text-[#1f1f1f] dark:text-zinc-200">
                {profile.name}
              </span>{" "}
              não aparece no seu feed, não pode te enviar mensagens e o perfil
              fica restrito. Você pode desbloquear a qualquer momento.
            </p>
            {blockError && (
              <p className="mt-2 text-xs font-medium text-red-600">{blockError}</p>
            )}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <Button type="button" onClick={onUnblock}>
                Desbloquear
              </Button>
              <Link href="/app">
                <Button type="button" variant="outline">
                  Voltar ao feed
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handle = profile.email.split("@")[0];

  return (
    <div className="app-page mx-auto max-w-[40rem] px-4 py-6 sm:px-6 sm:py-8">
      {/* Top bar */}
      <div className="mb-5 flex items-center justify-between gap-2">
        <Link
          href="/app"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-neutral-500 transition-colors hover:text-[#1f1f1f]"
        >
          <ArrowLeft size={15} weight="bold" />
          Feed
        </Link>
        <div className="flex items-center gap-2">
          {isOwn && (
            <Link href="/app/profile">
              <Button variant="outline" size="sm">
                <PencilSimple size={14} weight="bold" />
                Editar perfil
              </Button>
            </Link>
          )}
          {!isOwn && me && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onBlock}
              className="text-red-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700"
            >
              <Prohibit size={14} weight="bold" />
              Bloquear
            </Button>
          )}
        </div>
      </div>
      {(blockError || followError) && (
        <p className="mb-3 text-xs font-medium text-red-600">
          {blockError || followError}
        </p>
      )}

      {/* Profile card */}
      <article className="rounded-2xl border border-neutral-200/90 bg-white shadow-[0_1px_3px_rgb(0_0_0/0.04),0_8px_24px_-12px_rgb(0_0_0/0.08)]">
        {/* Banner: isolado, sem overflow vazando no avatar */}
        <div className="relative h-36 overflow-hidden rounded-t-2xl bg-neutral-200 sm:h-44">
          {profile.bannerUrl ? (
            <BannerImage
              src={profile.bannerUrl}
              fit={profile.bannerFit}
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-neutral-800 via-neutral-600 to-neutral-400" />
          )}
          {profile.bannerUrl &&
            isGifDataUrl(profile.bannerUrl) &&
            profile.isVip && (
              <span className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
                <CrownSimple size={10} weight="fill" className="text-amber-300" />
                GIF
              </span>
            )}
        </div>

        {/* Body: avatar absoluto + espaço reservado */}
        <div className="relative px-5 pb-0 sm:px-6">
          {/* Avatar row */}
          <div className="relative flex h-12 items-start justify-end sm:h-14">
            <div className="absolute -top-14 left-0 z-10 sm:-top-16">
              <Avatar
                name={profile.name}
                src={profile.avatarUrl}
                size="2xl"
                frame={profile.isVip ? profile.avatarFrame : null}
              />
            </div>

            {!isOwn && me && (
              <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={amFollowing ? "outline" : "primary"}
                  onClick={onToggleFollow}
                  className="min-w-[7.5rem]"
                >
                  {amFollowing ? (
                    <>
                      <UserMinus size={14} weight="bold" />
                      Seguindo
                    </>
                  ) : (
                    <>
                      <UserPlus size={14} weight="bold" />
                      Seguir
                    </>
                  )}
                </Button>
                <Link href={`/app/chat?dm=${encodeURIComponent(id)}`}>
                  <Button variant="outline" size="sm">
                    <ChatCircle size={14} weight="bold" />
                    Mensagem
                  </Button>
                </Link>
              </div>
            )}
            {isOwn && (
              <Link href="/app/profile" className="mt-3 sm:hidden">
                <Button variant="outline" size="sm">
                  Editar
                </Button>
              </Link>
            )}
          </div>

          {/* Identity */}
          <div className="mt-2 sm:mt-3">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="inline-flex items-center gap-1.5 text-[1.375rem] font-semibold leading-tight tracking-tight text-[#1f1f1f] sm:text-[1.5rem]">
                {profile.name}
                {profile.isVerified && <VerifiedBadge size={20} />}
              </h1>
              {profile.isVip && (
                <Badge variant="vip" className="shrink-0">
                  <CrownSimple size={10} weight="fill" className="mr-0.5" />
                  VIP
                </Badge>
              )}
              {profile.role === "admin" && (
                <Badge variant="outline" className="shrink-0">
                  Admin
                </Badge>
              )}
            </div>

            <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-neutral-400">
              <span>@{handle}</span>
              <ProfileEmblem id={equippedEmblem} size={22} />
            </p>

            {isOwn && !profile.isVerified && (
              <Link
                href="/app/verification"
                className="pressable mt-3 inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3.5 py-1.5 text-[13px] font-semibold text-sky-800 transition hover:bg-sky-100"
              >
                <VerifiedBadge size={15} />
                Obter perfil verificado
              </Link>
            )}

            {profile.bio ? (
              <p className="mt-3 max-w-[42ch] text-[14px] leading-relaxed text-neutral-600">
                <RichText text={profile.bio} emojiSize={18} />
              </p>
            ) : (
              <p className="mt-3 text-[14px] text-neutral-400">Sem bio ainda.</p>
            )}

            {profile.links?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {profile.links.map((l) => (
                  <a
                    key={l.id}
                    href={normalizeUrl(l.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="pressable inline-flex max-w-full items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-[12px] font-semibold text-[#1f1f1f] transition hover:border-[#1f1f1f]/30 hover:bg-white hover:shadow-sm"
                  >
                    <ProfileLinkIcon url={l.url} size={15} />
                    <span className="truncate">
                      {l.label || displayHost(l.url)}
                    </span>
                  </a>
                ))}
              </div>
            )}

            {profile.isVip &&
              profile.favoriteTracks &&
              profile.favoriteTracks.length > 0 && (
                <div className="mt-4">
                  <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                    <Headphones size={12} weight="bold" />
                    Ouvindo agora
                  </p>
                  <ul className="space-y-1.5">
                    {profile.favoriteTracks.map((t) => (
                      <li key={t.id}>
                        <MusicTrackPlayer track={t} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            {(profile.interests?.length > 0 || profile.goals?.length > 0) && (
              <div className="mt-4 space-y-3">
                {profile.interests?.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                      Interesses
                    </p>
                    <TagList tags={profile.interests} />
                  </div>
                )}
                {profile.goals?.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                      Objetivos
                    </p>
                    <ul className="space-y-1">
                      {profile.goals.map((g) => (
                        <li
                          key={g}
                          className="text-[13px] leading-relaxed text-neutral-600 before:mr-1.5 before:text-neutral-300 before:content-['→']"
                        >
                          {g}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {profile.seekingMentorship && (
                    <Badge variant="outline">Busca mentoria</Badge>
                  )}
                  {profile.offeringMentorship && (
                    <Badge variant="vip">Oferece mentoria</Badge>
                  )}
                </div>
              </div>
            )}

            {/* Stats — estilo Instagram */}
            <div className="mt-5 flex items-center gap-0 divide-x divide-neutral-200 border-t border-neutral-100 pt-4 text-center dark:divide-zinc-700 dark:border-zinc-800">
              <div className="flex-1 px-2">
                <p className="text-base font-semibold tabular-nums tracking-tight text-[#1f1f1f] dark:text-zinc-50">
                  {userPosts.length}
                </p>
                <p className="mt-0.5 text-[11px] font-medium text-neutral-400">
                  publicações
                </p>
              </div>
              <div className="flex-1 px-2">
                <p className="text-base font-semibold tabular-nums tracking-tight text-[#1f1f1f] dark:text-zinc-50">
                  {nFollowers}
                </p>
                <p className="mt-0.5 text-[11px] font-medium text-neutral-400">
                  {nFollowers === 1 ? "seguidor" : "seguidores"}
                </p>
              </div>
              <div className="flex-1 px-2">
                <p className="text-base font-semibold tabular-nums tracking-tight text-[#1f1f1f] dark:text-zinc-50">
                  {nFollowing}
                </p>
                <p className="mt-0.5 text-[11px] font-medium text-neutral-400">
                  seguindo
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-5 flex border-t border-neutral-100">
          <button
            type="button"
            onClick={() => setTab("posts")}
            className={
              tab === "posts"
                ? "pressable flex flex-1 items-center justify-center gap-2 border-b-2 border-[#1f1f1f] py-3.5 text-[13px] font-semibold text-[#1f1f1f] transition-colors"
                : "pressable flex flex-1 items-center justify-center gap-2 border-b-2 border-transparent py-3.5 text-[13px] font-medium text-neutral-400 transition-colors hover:text-neutral-600"
            }
          >
            <GridFour size={15} weight={tab === "posts" ? "fill" : "regular"} />
            Publicações
          </button>
          <button
            type="button"
            onClick={() => setTab("about")}
            className={
              tab === "about"
                ? "pressable flex flex-1 items-center justify-center gap-2 border-b-2 border-[#1f1f1f] py-3.5 text-[13px] font-semibold text-[#1f1f1f] transition-colors"
                : "pressable flex flex-1 items-center justify-center gap-2 border-b-2 border-transparent py-3.5 text-[13px] font-medium text-neutral-400 transition-colors hover:text-neutral-600"
            }
          >
            Sobre
          </button>
        </div>
      </article>

      {/* Content */}
      <div className="mt-5">
        {tab === "posts" && (
          <div className="space-y-3">
            {userPosts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-neutral-300 bg-white/80 px-6 py-14 text-center">
                <p className="text-sm font-medium text-neutral-600">
                  Nenhuma publicação ainda
                </p>
                {isOwn && (
                  <Link href="/app" className="mt-4 inline-block">
                    <Button size="sm">Publicar no feed</Button>
                  </Link>
                )}
              </div>
            ) : (
              userPosts.map((post) => <PostCard key={post.id} post={post} />)
            )}
          </div>
        )}

        {tab === "about" && (
          <div className="rounded-2xl border border-neutral-200/90 bg-white p-6 shadow-[0_1px_3px_rgb(0_0_0/0.04)]">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
              Sobre
            </h2>
            <dl className="mt-5 space-y-5">
              <div>
                <dt className="text-[12px] font-medium text-neutral-400">
                  Nome
                </dt>
                <dd className="mt-1 text-[15px] font-medium tracking-tight text-[#1f1f1f]">
                  {profile.name}
                </dd>
              </div>
              <div>
                <dt className="text-[12px] font-medium text-neutral-400">Bio</dt>
                <dd className="mt-1 text-[15px] leading-relaxed text-neutral-700">
                  {profile.bio ? (
                    <RichText text={profile.bio} emojiSize={18} />
                  ) : (
                    "Não informado."
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-[12px] font-medium text-neutral-400">
                  Membro desde
                </dt>
                <dd className="mt-1 text-[15px] font-medium text-[#1f1f1f]">
                  {formatDate(profile.createdAt)}
                </dd>
              </div>
              <div>
                <dt className="text-[12px] font-medium text-neutral-400">
                  Status
                </dt>
                <dd className="mt-1 text-[15px] font-medium text-[#1f1f1f]">
                  {profile.isVip ? "Plano VIP" : "Membro free"}
                  {profile.role === "admin" ? " · Admin" : ""}
                </dd>
              </div>
              {profile.interests?.length > 0 && (
                <div>
                  <dt className="text-[12px] font-medium text-neutral-400">
                    Interesses
                  </dt>
                  <dd className="mt-2">
                    <TagList tags={profile.interests} />
                  </dd>
                </div>
              )}
              {profile.goals?.length > 0 && (
                <div>
                  <dt className="text-[12px] font-medium text-neutral-400">
                    Objetivos
                  </dt>
                  <dd className="mt-1 space-y-1 text-[15px] leading-relaxed text-neutral-700">
                    {profile.goals.map((g) => (
                      <p key={g}>{g}</p>
                    ))}
                  </dd>
                </div>
              )}
              {profile.links?.length > 0 && (
                <div>
                  <dt className="text-[12px] font-medium text-neutral-400">
                    Links
                  </dt>
                  <dd className="mt-2 flex flex-wrap gap-2">
                    {profile.links.map((l) => (
                      <a
                        key={l.id}
                        href={normalizeUrl(l.url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-[12px] font-semibold text-[#1f1f1f] hover:border-[#1f1f1f]/30"
                      >
                        <ProfileLinkIcon url={l.url} size={15} />
                        {l.label || displayHost(l.url)}
                      </a>
                    ))}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        )}
      </div>
    </div>
  );
}
