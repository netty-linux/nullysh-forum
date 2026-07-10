"use client";

import { StoryComposer } from "@/components/story-composer";
import { StoryViewer } from "@/components/story-viewer";
import { Avatar } from "@/components/ui/avatar";
import { useBlockStore } from "@/lib/block-store";
import {
  useSocialStore,
  type StoryAuthorGroup,
} from "@/lib/social-store";
import { cn } from "@/lib/utils";
import { Plus } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";

type UserLite = {
  id: string;
  name: string;
  avatar: string;
  avatarUrl?: string | null;
};

type Props = {
  user: UserLite | null;
  /** feed = só following + eu · popular = todos */
  mode?: "feed" | "popular";
  className?: string;
};

/**
 * Faixa horizontal de stories estilo Instagram.
 * + no avatar abre o composer (vários stories); tap no ring abre o viewer.
 */
export function StoriesTray({ user, mode = "feed", className }: Props) {
  const follows = useSocialStore((s) => s.follows);
  const stories = useSocialStore((s) => s.stories);
  const mediaHydrated = useSocialStore((s) => s.mediaHydrated);
  const getStoryGroups = useSocialStore((s) => s.getStoryGroups);
  const purgeExpired = useSocialStore((s) => s.purgeExpired);
  const hydrateMedia = useSocialStore((s) => s.hydrateMedia);
  const isEitherBlocked = useBlockStore((s) => s.isEitherBlocked);
  const blocks = useBlockStore((s) => s.blocks);

  const [composerOpen, setComposerOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [startGroup, setStartGroup] = useState(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    purgeExpired();
    if (!mediaHydrated) void hydrateMedia();
  }, [purgeExpired, stories.length, mediaHydrated, hydrateMedia]);

  useEffect(() => {
    const t = window.setInterval(() => setTick((n) => n + 1), 60_000);
    return () => window.clearInterval(t);
  }, []);

  const groups: StoryAuthorGroup[] = useMemo(() => {
    void follows;
    void blocks;
    void tick;
    void mediaHydrated;
    const raw = getStoryGroups({
      viewerId: user?.id,
      followingOnly: mode === "feed",
    });
    if (!user) return raw;
    return raw.filter(
      (g) =>
        g.authorId === user.id || !isEitherBlocked(user.id, g.authorId)
    );
  }, [
    getStoryGroups,
    user,
    mode,
    follows,
    stories,
    tick,
    isEitherBlocked,
    blocks,
    mediaHydrated,
  ]);

  const trayItems = useMemo(() => {
    if (!user) return groups;
    const hasMine = groups.some((g) => g.authorId === user.id);
    if (hasMine) {
      const mine = groups.find((g) => g.authorId === user.id)!;
      const rest = groups.filter((g) => g.authorId !== user.id);
      return [mine, ...rest];
    }
    return [
      {
        authorId: user.id,
        authorName: user.name,
        authorAvatar: user.avatar,
        authorAvatarUrl: user.avatarUrl ?? null,
        stories: [],
        hasUnseen: false,
        latestAt: new Date(0).toISOString(),
      } satisfies StoryAuthorGroup,
      ...groups,
    ];
  }, [groups, user]);

  function openGroup(index: number) {
    const g = trayItems[index];
    if (!g) return;
    if (g.authorId === user?.id && g.stories.length === 0) {
      setComposerOpen(true);
      return;
    }
    if (g.stories.length === 0) return;
    const realGroups = groups.filter((x) => x.stories.length > 0);
    const realIdx = realGroups.findIndex((x) => x.authorId === g.authorId);
    if (realIdx < 0) return;
    setStartGroup(realIdx);
    setViewerOpen(true);
  }

  const viewerGroups = groups.filter((g) => g.stories.length > 0);

  return (
    <div className={cn("w-full", className)}>
      <div className="thin-scroll flex gap-3 overflow-x-auto pb-1 pt-0.5">
        {trayItems.map((g, i) => {
          const isMe = user?.id === g.authorId;
          const hasStories = g.stories.length > 0;
          const ringUnseen = hasStories && (isMe ? false : g.hasUnseen);
          const ringSeen = hasStories && !ringUnseen && !isMe;
          const emptyMine = isMe && !hasStories;
          const multi = hasStories && g.stories.length > 1;

          return (
            <div
              key={g.authorId}
              className="group relative flex w-[72px] shrink-0 flex-col items-center gap-1.5"
            >
              <button
                type="button"
                onClick={() => openGroup(i)}
                className="flex w-full flex-col items-center gap-1.5"
              >
                <div
                  className={cn(
                    "relative rounded-full p-[2.5px]",
                    ringUnseen && "story-ring",
                    ringSeen && "bg-neutral-300 dark:bg-zinc-600",
                    emptyMine && "bg-neutral-200 dark:bg-zinc-700",
                    isMe &&
                      hasStories &&
                      "bg-gradient-to-tr from-neutral-400 to-neutral-600"
                  )}
                >
                  <div className="rounded-full bg-white p-[2px] dark:bg-[#141414]">
                    <Avatar
                      name={g.authorName}
                      src={g.authorAvatarUrl}
                      size="lg"
                    />
                  </div>
                  {multi && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#1f1f1f] px-1 text-[9px] font-bold text-white ring-2 ring-white dark:ring-[#141414]">
                      {g.stories.length}
                    </span>
                  )}
                </div>
                <span className="w-full truncate text-center text-[11px] font-medium text-neutral-600 dark:text-zinc-400">
                  {isMe ? "Seu story" : g.authorName.split(" ")[0]}
                </span>
              </button>

              {/* + sempre adiciona novo story (vários no dia) */}
              {isMe && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setComposerOpen(true);
                  }}
                  className={cn(
                    "absolute bottom-[18px] right-0 z-10 flex h-5 w-5 items-center justify-center rounded-full",
                    "border-2 border-white bg-[#1f1f1f] text-white",
                    "dark:border-[#141414]",
                    "hover:scale-110 active:scale-95"
                  )}
                  aria-label="Adicionar story"
                  title="Adicionar story"
                >
                  <Plus size={11} weight="bold" />
                </button>
              )}
            </div>
          );
        })}

        {trayItems.length === 0 && (
          <p className="px-1 py-4 text-sm text-neutral-400">
            {mode === "popular"
              ? "Nenhum story popular no momento."
              : "Siga pessoas para ver stories aqui — ou publique o seu."}
          </p>
        )}
      </div>

      {user && (
        <StoryComposer
          open={composerOpen}
          user={user}
          onClose={() => setComposerOpen(false)}
        />
      )}

      <StoryViewer
        open={viewerOpen}
        groups={viewerGroups}
        startGroupIndex={startGroup}
        viewerId={user?.id}
        onClose={() => setViewerOpen(false)}
      />
    </div>
  );
}
