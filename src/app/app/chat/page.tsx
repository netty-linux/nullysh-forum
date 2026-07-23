"use client";

import {
  ChatComposer,
  type ChatSendPayload,
} from "@/components/chat-composer";
import { ChatMessageRow } from "@/components/chat-message-row";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { VerifiedBadge } from "@/components/verified-badge";
import { VipGate, VipBadge } from "@/components/vip-gate";
import { useAuth } from "@/hooks/use-auth";
import { useAuthStore } from "@/lib/auth-store";
import { useBlockStore } from "@/lib/block-store";
import {
  countUnreadInChannel,
  markChannelAsRead,
  useChatReadStore,
} from "@/lib/chat-read-store";
import {
  dmChannelId,
  getDmPeerId,
  isDmChannel,
  isParticipantOfDm,
} from "@/lib/dm";
import { chatChannels } from "@/lib/mock-data";
import { useForumStore } from "@/lib/forum-store";
import type { UserPublic } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  ChatTeardropText,
  ChatsCircle,
  Hash,
  MagnifyingGlass,
  UserCircle,
  UsersThree,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/** Badge de não lidas estilo Messenger / WhatsApp */
function UnreadBadge({
  count,
  selected,
}: {
  count: number;
  selected?: boolean;
}) {
  if (count <= 0) return null;
  const label = count > 99 ? "99+" : String(count);
  return (
    <span
      className={cn(
        "ml-auto inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums leading-none transition-all",
        selected
          ? "bg-white text-neutral-950 dark:bg-zinc-100 dark:text-neutral-950 shadow-xs"
          : "bg-emerald-500 text-white shadow-xs"
      )}
      aria-label={`${count} não lida${count > 1 ? "s" : ""}`}
    >
      {label}
    </span>
  );
}

type ActiveChat =
  | { kind: "channel"; id: string }
  | { kind: "dm"; peerId: string; channelId: string };

function ChatPageInner() {
  const { user, isVip } = useAuth();
  const users = useAuthStore((s) => s.users);
  const messages = useForumStore((s) => s.messages);
  const posts = useForumStore((s) => s.posts);
  const sendMessage = useForumStore((s) => s.sendMessage);
  const deleteMessage = useForumStore((s) => s.deleteMessage);
  const toggleMessageReaction = useForumStore((s) => s.toggleMessageReaction);
  const readCursors = useChatReadStore((s) => s.cursors);
  const isEitherBlocked = useBlockStore((s) => s.isEitherBlocked);
  const blocks = useBlockStore((s) => s.blocks);
  const searchParams = useSearchParams();
  const dmParam = searchParams.get("dm");
  const channelParam = searchParams.get("channel");

  const [active, setActive] = useState<ActiveChat>({
    kind: "channel",
    id: chatChannels[0].id,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [reactionError, setReactionError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);

  // Erro de reação
  useEffect(() => {
    function onErr(e: Event) {
      const detail = (e as CustomEvent<{ error?: string }>).detail;
      const msg = detail?.error || "Não foi possível reagir.";
      setReactionError(msg);
      window.setTimeout(() => setReactionError(""), 4200);
    }
    window.addEventListener("nullysh:chat-reaction-error", onErr);
    return () =>
      window.removeEventListener("nullysh:chat-reaction-error", onErr);
  }, []);

  // Abre sala quando vem de ?channel=ch1
  useEffect(() => {
    if (!channelParam || dmParam) return;
    const ch = chatChannels.find(
      (c) => c.id === channelParam || c.name === channelParam
    );
    if (!ch) return;
    setActive((prev) =>
      prev.kind === "channel" && prev.id === ch.id
        ? prev
        : { kind: "channel", id: ch.id }
    );
  }, [channelParam, dmParam]);

  // Abre DM quando vem de ?dm=userId
  const userId = user?.id;
  useEffect(() => {
    if (!userId || !dmParam || dmParam === userId) return;
    if (isEitherBlocked(userId, dmParam)) return;
    const peer = users.find((u) => u.id === dmParam);
    if (!peer) return;
    const channelId = dmChannelId(userId, peer.id);
    setActive((prev) => {
      if (
        prev.kind === "dm" &&
        prev.peerId === peer.id &&
        prev.channelId === channelId
      ) {
        return prev;
      }
      return { kind: "dm", peerId: peer.id, channelId };
    });
  }, [dmParam, userId, users, isEitherBlocked, blocks]);

  // Lista de DMs recentes
  const dmPeers = useMemo(() => {
    if (!user) return [] as { peer: UserPublic; channelId: string; lastAt: string }[];

    const map = new Map<
      string,
      { peer: UserPublic; channelId: string; lastAt: string }
    >();

    for (const m of messages) {
      if (!isDmChannel(m.channelId)) continue;
      if (!isParticipantOfDm(m.channelId, user.id)) continue;
      const peerId = getDmPeerId(m.channelId, user.id);
      if (!peerId) continue;
      if (isEitherBlocked(user.id, peerId)) continue;
      const peerUser = users.find((u) => u.id === peerId);
      if (!peerUser) continue;

      const { password: _pw, ...peerRest } = peerUser;
      const peer: UserPublic = {
        ...peerRest,
        bannerFit: peerUser.bannerFit ?? null,
        favoriteTracks: peerUser.favoriteTracks ?? [],
        badgesUnlocked: peerUser.badgesUnlocked ?? [],
        badgeEquipped: peerUser.badgeEquipped ?? null,
      };
      const prev = map.get(peerId);
      if (!prev || new Date(m.createdAt) > new Date(prev.lastAt)) {
        map.set(peerId, {
          peer,
          channelId: m.channelId,
          lastAt: m.createdAt,
        });
      }
    }

    if (
      active.kind === "dm" &&
      !map.has(active.peerId) &&
      !isEitherBlocked(user.id, active.peerId)
    ) {
      const peerUser = users.find((u) => u.id === active.peerId);
      if (peerUser) {
        const { password: _p2, ...rest } = peerUser;
        map.set(active.peerId, {
          peer: {
            ...rest,
            bannerFit: peerUser.bannerFit ?? null,
            favoriteTracks: peerUser.favoriteTracks ?? [],
            badgesUnlocked: peerUser.badgesUnlocked ?? [],
            badgeEquipped: peerUser.badgeEquipped ?? null,
          },
          channelId: active.channelId,
          lastAt: new Date(0).toISOString(),
        });
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime()
    );
  }, [messages, user, users, active, isEitherBlocked, blocks]);

  // Filtro de salas e DMs pela busca
  const filteredChannels = useMemo(() => {
    if (!searchQuery.trim()) return chatChannels;
    const q = searchQuery.toLowerCase().trim();
    return chatChannels.filter(
      (c) => c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const filteredDmPeers = useMemo(() => {
    if (!searchQuery.trim()) return dmPeers;
    const q = searchQuery.toLowerCase().trim();
    return dmPeers.filter(
      (item) =>
        item.peer.name.toLowerCase().includes(q) ||
        item.peer.username.toLowerCase().includes(q)
    );
  }, [dmPeers, searchQuery]);

  const channelId =
    active.kind === "channel" ? active.id : active.channelId;

  const publicChannel =
    active.kind === "channel"
      ? chatChannels.find((c) => c.id === active.id)
      : undefined;

  const dmPeer =
    active.kind === "dm"
      ? users.find((u) => u.id === active.peerId) ?? null
      : null;

  const locked = !!(publicChannel?.vipOnly && !isVip);

  const channelMessages = useMemo(
    () =>
      messages
        .filter((m) => m.channelId === channelId)
        .sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        ),
    [messages, channelId]
  );

  const unreadByChannel = useMemo(() => {
    const map: Record<string, number> = {};
    if (!user) return map;
    for (const ch of chatChannels) {
      map[ch.id] = countUnreadInChannel(
        messages,
        ch.id,
        user.id,
        readCursors[ch.id] ?? null
      );
    }
    for (const { channelId: cid } of dmPeers) {
      map[cid] = countUnreadInChannel(
        messages,
        cid,
        user.id,
        readCursors[cid] ?? null
      );
    }
    return map;
  }, [messages, user, readCursors, dmPeers]);

  function openChannel(id: string) {
    setActive({ kind: "channel", id });
  }

  function openDm(peerId: string) {
    if (!user || peerId === user.id) return;
    if (isEitherBlocked(user.id, peerId)) return;
    setActive({
      kind: "dm",
      peerId,
      channelId: dmChannelId(user.id, peerId),
    });
  }

  const dmBlocked =
    active.kind === "dm" &&
    !!user &&
    isEitherBlocked(user.id, active.peerId);

  useEffect(() => {
    if (!user || locked || dmBlocked) return;
    void markChannelAsRead(channelId);
  }, [channelId, user?.id, locked, dmBlocked, channelMessages.length]);

  useEffect(() => {
    if (!stickToBottomRef.current) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [channelMessages.length, channelId]);

  useEffect(() => {
    stickToBottomRef.current = true;
  }, [channelId]);

  useEffect(() => {
    if (dmBlocked) {
      setActive({ kind: "channel", id: chatChannels[0].id });
    }
  }, [dmBlocked]);

  function onSend(payload: ChatSendPayload) {
    if (!user || locked) return;
    if (active.kind === "dm" && isEitherBlocked(user.id, active.peerId)) {
      return;
    }
    const hasMedia =
      payload.mediaKind &&
      payload.mediaKind !== "text" &&
      (payload.mediaUrl || payload.mediaKind === "sticker");
    if (!payload.content.trim() && !hasMedia && !payload.mediaUrl) return;

    void (async () => {
      try {
        await sendMessage({
          channelId,
          authorId: user.id,
          authorName: user.name,
          authorAvatar: user.avatar,
          content: payload.content,
          mediaKind: payload.mediaKind,
          mediaUrl: payload.mediaUrl,
          mediaMime: payload.mediaMime,
          mediaDuration: payload.mediaDuration,
          mediaThumbUrl: payload.mediaThumbUrl,
          mediaWidth: payload.mediaWidth,
          mediaHeight: payload.mediaHeight,
        });
      } catch (e) {
        console.error("[chat] send failed", e);
      }
    })();
  }

  const headerTitle =
    active.kind === "dm"
      ? dmPeer?.name ?? "Direct"
      : `#${publicChannel?.name ?? "chat"}`;

  const headerSub =
    active.kind === "dm"
      ? dmBlocked
        ? "Conversa indisponível · Bloqueio ativo"
        : "Mensagem Direta · Privado entre vocês"
      : publicChannel?.description ?? "Canal de conversas";

  const placeholder =
    active.kind === "dm"
      ? dmBlocked
        ? "Não é possível enviar mensagens"
        : `Mensagem para ${dmPeer?.name?.split(" ")[0] ?? "contato"}…`
      : `Mensagem em #${publicChannel?.name ?? "sala"}`;

  return (
    <div className="app-page mx-auto flex h-[calc(100dvh-4rem)] max-w-6xl flex-col px-2 sm:px-6 sm:py-6 lg:h-[calc(100dvh-2.5rem)]">
      {reactionError && (
        <div
          role="alert"
          className="mx-3 mb-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 sm:mx-0 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300"
        >
          {reactionError}
        </div>
      )}

      {/* Main Glass Messenger Frame */}
      <div className="flex min-h-0 flex-1 overflow-hidden rounded-3xl border border-neutral-200/90 bg-white shadow-xl dark:border-zinc-800 dark:bg-[#141414]">
        {/* Left Sidebar */}
        <aside className="hidden w-72 shrink-0 border-r border-neutral-200/80 bg-neutral-50/60 dark:border-zinc-800 dark:bg-[#101010]/90 md:flex md:flex-col">
          {/* Sidebar Header */}
          <div className="border-b border-neutral-200/80 p-4 dark:border-zinc-800/80">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-neutral-900 text-white dark:bg-zinc-100 dark:text-neutral-950">
                <ChatTeardropText size={18} weight="fill" />
              </span>
              <div>
                <h1 className="font-display text-sm font-semibold tracking-tight text-[#1f1f1f] dark:text-zinc-100">
                  Bate-Papo
                </h1>
                <p className="text-[11px] text-neutral-500 dark:text-zinc-400">
                  Salas & Mensagens Diretas
                </p>
              </div>
            </div>

            {/* Quick Filter Input */}
            <div className="relative mt-3">
              <MagnifyingGlass
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-zinc-500"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar conversas..."
                className="w-full rounded-xl border border-neutral-200/80 bg-white py-1.5 pl-8 pr-3 text-xs text-neutral-900 placeholder-neutral-400 transition-all focus:border-neutral-400 focus:outline-none dark:border-zinc-800 dark:bg-[#18181b] dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-700"
              />
            </div>
          </div>

          {/* Sidebar Conversations List */}
          <div className="thin-scroll flex-1 overflow-y-auto p-2 space-y-4">
            {/* Community Channels */}
            <div>
              <p className="flex items-center gap-1.5 px-2.5 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-zinc-500">
                <UsersThree size={13} weight="bold" />
                Salas da Comunidade
              </p>
              <div className="space-y-1">
                {filteredChannels.map((ch) => {
                  const selected =
                    active.kind === "channel" && active.id === ch.id;
                  const unread = unreadByChannel[ch.id] ?? 0;
                  return (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => openChannel(ch.id)}
                      className={cn(
                        "group flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-medium transition-all",
                        selected
                          ? "bg-[#1f1f1f] text-white shadow-sm dark:bg-zinc-100 dark:text-neutral-950 font-semibold"
                          : "text-neutral-700 hover:bg-neutral-200/60 dark:text-zinc-300 dark:hover:bg-zinc-800/80",
                        unread > 0 && !selected && "font-bold text-neutral-950 dark:text-white"
                      )}
                    >
                      <span className="flex min-w-0 flex-1 items-center gap-2 truncate">
                        <Hash
                          size={15}
                          weight="bold"
                          className={cn(
                            "shrink-0 transition-opacity",
                            selected ? "opacity-100" : "opacity-40 group-hover:opacity-70"
                          )}
                        />
                        <span className="truncate">{ch.name}</span>
                      </span>
                      {ch.vipOnly && unread === 0 && (
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide",
                            selected
                              ? "bg-amber-400 text-neutral-950"
                              : "bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400"
                          )}
                        >
                          VIP
                        </span>
                      )}
                      <UnreadBadge count={unread} selected={selected} />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Direct Messages */}
            <div>
              <p className="flex items-center gap-1.5 px-2.5 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-zinc-500">
                <ChatsCircle size={13} weight="bold" />
                Mensagens Diretas
              </p>
              <div className="space-y-1">
                {filteredDmPeers.length === 0 && (
                  <p className="px-3 py-3 text-xs leading-relaxed text-neutral-400 dark:text-zinc-500 italic">
                    Nenhuma conversa iniciada. Clique em <strong className="font-semibold text-neutral-600 dark:text-zinc-300">Conversar</strong> no perfil de um membro.
                  </p>
                )}
                {filteredDmPeers.map(({ peer, channelId: cid }) => {
                  const selected =
                    active.kind === "dm" && active.channelId === cid;
                  const unread = unreadByChannel[cid] ?? 0;
                  return (
                    <button
                      key={cid}
                      type="button"
                      onClick={() => openDm(peer.id)}
                      className={cn(
                        "group flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-all",
                        selected
                          ? "bg-[#1f1f1f] text-white shadow-sm dark:bg-zinc-100 dark:text-neutral-950"
                          : "text-neutral-700 hover:bg-neutral-200/60 dark:text-zinc-300 dark:hover:bg-zinc-800/80"
                      )}
                    >
                      <div className="relative shrink-0">
                        <Avatar
                          name={peer.name}
                          src={peer.avatarUrl}
                          size="sm"
                          frame={peer.isVip ? peer.avatarFrame : null}
                        />
                        <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#101010]" />
                      </div>
                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            "flex items-center gap-1 truncate text-xs",
                            unread > 0 || selected ? "font-bold" : "font-semibold"
                          )}
                        >
                          <span className="truncate">{peer.name}</span>
                          {peer.isVerified && (
                            <VerifiedBadge
                              size={12}
                              className={selected ? "opacity-90" : undefined}
                            />
                          )}
                        </span>
                        <span
                          className={cn(
                            "block truncate text-[11px]",
                            selected ? "opacity-70" : "text-neutral-400 dark:text-zinc-400",
                            unread > 0 && !selected && "font-semibold text-emerald-600 dark:text-emerald-400"
                          )}
                        >
                          {unread > 0
                            ? `${unread} nova${unread > 1 ? "s" : ""}`
                            : "Direct Privado"}
                        </span>
                      </span>
                      <UnreadBadge count={unread} selected={selected} />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </aside>

        {/* Main Conversation Stream */}
        <div className="flex min-w-0 flex-1 flex-col bg-white dark:bg-[#141414]">
          {/* Header Bar */}
          <div className="flex items-center justify-between gap-3 border-b border-neutral-200/80 px-5 py-3.5 dark:border-zinc-800/80">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3">
                {active.kind === "dm" && dmPeer ? (
                  <Link
                    href={`/app/u/${dmPeer.id}`}
                    className="avatar-link shrink-0 transition-transform hover:scale-105"
                  >
                    <div className="relative">
                      <Avatar
                        name={dmPeer.name}
                        src={dmPeer.avatarUrl}
                        size="md"
                        frame={dmPeer.isVip ? dmPeer.avatarFrame : null}
                      />
                      <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#141414]" />
                    </div>
                  </Link>
                ) : (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-800 dark:bg-zinc-800 dark:text-zinc-200">
                    <Hash size={20} weight="bold" />
                  </span>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-sm font-semibold tracking-tight text-[#1f1f1f] dark:text-zinc-50 sm:text-base truncate">
                      {headerTitle}
                    </h2>
                    {publicChannel?.vipOnly && <VipBadge />}
                    {active.kind === "dm" && (
                      <span className="shrink-0 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-800 dark:bg-sky-950/50 dark:text-sky-300 border border-sky-200/60 dark:border-sky-800/60">
                        Direct
                      </span>
                    )}
                    {active.kind === "dm" && dmPeer?.isVerified && (
                      <VerifiedBadge size={15} />
                    )}
                  </div>
                  <p className="truncate text-xs text-neutral-500 dark:text-zinc-400">{headerSub}</p>
                </div>
              </div>
            </div>

            {active.kind === "dm" && dmPeer && (
              <Link href={`/app/u/${dmPeer.id}`} className="shrink-0">
                <Button size="sm" variant="outline" className="rounded-full text-xs gap-1.5">
                  <UserCircle size={15} weight="bold" />
                  Ver Perfil
                </Button>
              </Link>
            )}
          </div>

          {/* Mobile Filter Tabs */}
          <div className="flex gap-2 overflow-x-auto border-b border-neutral-100 px-4 py-2 md:hidden dark:border-zinc-800">
            {chatChannels.map((ch) => {
              const selected =
                active.kind === "channel" && active.id === ch.id;
              const unread = unreadByChannel[ch.id] ?? 0;
              return (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => openChannel(ch.id)}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all",
                    selected
                      ? "bg-neutral-900 text-white dark:bg-zinc-100 dark:text-neutral-950 font-semibold"
                      : "bg-neutral-100 text-neutral-600 dark:bg-zinc-800 dark:text-zinc-400"
                  )}
                >
                  #{ch.name}
                  {unread > 0 && (
                    <span
                      className={cn(
                        "inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold",
                        selected
                          ? "bg-white text-black"
                          : "bg-emerald-500 text-white"
                      )}
                    >
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}
                </button>
              );
            })}
            {dmPeers.map(({ peer, channelId: cid }) => {
              const selected =
                active.kind === "dm" && active.peerId === peer.id;
              const unread = unreadByChannel[cid] ?? 0;
              return (
                <button
                  key={peer.id}
                  type="button"
                  onClick={() => openDm(peer.id)}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all",
                    selected
                      ? "bg-neutral-900 text-white dark:bg-zinc-100 dark:text-neutral-950 font-semibold"
                      : "bg-neutral-100 text-neutral-600 dark:bg-zinc-800 dark:text-zinc-400"
                  )}
                >
                  <Avatar name={peer.name} src={peer.avatarUrl} size="sm" className="!h-5 !w-5 !text-[9px]" />
                  {peer.name.split(" ")[0]}
                  {unread > 0 && (
                    <span
                      className={cn(
                        "inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold",
                        selected
                          ? "bg-white text-black"
                          : "bg-emerald-500 text-white"
                      )}
                    >
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Messages Body */}
          {locked ? (
            <div className="flex flex-1 items-center justify-center p-6">
              <VipGate
                title="Sala exclusiva VIP"
                description="Assine o Plano VIP para entrar neste canal e conversar com a comunidade premium."
              />
            </div>
          ) : (
            <>
              <div
                ref={listRef}
                className="thin-scroll flex-1 space-y-4 overflow-y-auto p-4 sm:p-6"
                onScroll={(e) => {
                  const el = e.currentTarget;
                  const dist =
                    el.scrollHeight - el.scrollTop - el.clientHeight;
                  stickToBottomRef.current = dist < 80;
                }}
              >
                {active.kind === "dm" && channelMessages.length === 0 && (
                  <div className="mx-auto max-w-sm py-12 text-center">
                    <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-neutral-100 dark:bg-zinc-800 ring-4 ring-neutral-50 dark:ring-zinc-900">
                      {dmPeer ? (
                        <Avatar
                          name={dmPeer.name}
                          src={dmPeer.avatarUrl}
                          size="lg"
                        />
                      ) : null}
                    </div>
                    <h3 className="font-display text-sm font-semibold text-[#1f1f1f] dark:text-zinc-100">
                      Conversa Direta com {dmPeer?.name ?? "usuário"}
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-neutral-500 dark:text-zinc-400">
                      Canal privado e seguro. Envie uma mensagem para iniciar o papo ou mentoria.
                    </p>
                  </div>
                )}

                {channelMessages.map((m) => {
                  const mine = !!(user && m.authorId === user.id);
                  const canDelete =
                    !!user &&
                    (m.authorId === user.id || user.role === "admin");
                  return (
                    <ChatMessageRow
                      key={m.id}
                      message={m}
                      mine={mine}
                      isDm={active.kind === "dm"}
                      canDelete={canDelete}
                      users={users}
                      posts={posts}
                      currentUserId={user?.id ?? null}
                      onDelete={(id) => {
                        if (!user) return;
                        void deleteMessage(id, user.id, {
                          isAdmin: user.role === "admin",
                        });
                      }}
                      onReact={(id, emoji) => {
                        if (!user) return;
                        toggleMessageReaction(id, user.id, emoji);
                      }}
                    />
                  );
                })}

                {active.kind === "channel" &&
                  channelMessages.length === 0 && (
                    <div className="py-16 text-center text-xs text-neutral-400 dark:text-zinc-500">
                      Nenhuma mensagem ainda neste canal. Envie a primeira!
                    </div>
                  )}
                <div ref={bottomRef} />
              </div>

              {/* Bottom Composer */}
              <div className="border-t border-neutral-100 bg-white p-3 dark:border-zinc-800 dark:bg-[#141414]">
                <ChatComposer
                  placeholder={placeholder}
                  disabled={dmBlocked || locked}
                  onSend={onSend}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-xs text-neutral-400">
          Carregando bate-papo…
        </div>
      }
    >
      <ChatPageInner />
    </Suspense>
  );
}

