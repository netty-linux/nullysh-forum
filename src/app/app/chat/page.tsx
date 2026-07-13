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
  ChatsCircle,
  Hash,
  UserCircle,
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

/** Badge de não lidas estilo WhatsApp (verde / contador) */
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
        "ml-auto inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums leading-none",
        selected
          ? "bg-white text-black dark:bg-black dark:text-white"
          : "bg-[#25d366] text-white"
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
  const [reactionError, setReactionError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);

  // Erro de reação (RPC/sessão/migration)
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

  // Abre sala quando vem de ?channel=ch1 (ex.: notif de reação no lobby)
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

  // Abre DM quando vem de ?dm=userId (ex.: botão Conversar no match)
  // Depende de userId (primitivo), não do objeto user inteiro.
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

  // Lista de DMs recentes (canais dm_* em que o usuário participa)
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
      // strip password shape — users from store include password
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

    // Inclui DM aberta via URL mesmo sem mensagens ainda
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

  // Marca sala como lida ao abrir / ao receber msgs enquanto está aberta
  useEffect(() => {
    if (!user || locked || dmBlocked) return;
    void markChannelAsRead(channelId);
  }, [channelId, user?.id, locked, dmBlocked, channelMessages.length]);

  // Auto-scroll só se o user já está perto do fim (conversa flui sem puxar se leu o histórico)
  useEffect(() => {
    if (!stickToBottomRef.current) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [channelMessages.length, channelId]);

  useEffect(() => {
    stickToBottomRef.current = true;
  }, [channelId]);

  // Se a DM ativa ficou bloqueada, volta para sala pública
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
        ? "Conversa indisponível · bloqueio ativo"
        : "Mensagem direta · privado entre vocês"
      : publicChannel?.description ?? "";

  const placeholder =
    active.kind === "dm"
      ? dmBlocked
        ? "Não é possível enviar mensagens"
        : `Mensagem para ${dmPeer?.name?.split(" ")[0] ?? "contato"}…`
      : `Mensagem em #${publicChannel?.name ?? "sala"}`;

  return (
    <div className="app-page mx-auto flex h-[calc(100dvh-3.5rem)] max-w-5xl flex-col px-0 sm:h-[100dvh] sm:px-6 sm:py-6 lg:h-[100dvh]">
      {reactionError && (
        <div
          role="alert"
          className="mx-3 mb-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[13px] font-medium text-red-700 sm:mx-0 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
        >
          {reactionError}
        </div>
      )}
      <div className="flex min-h-0 flex-1 overflow-hidden border-2 border-black bg-white sm:rounded-2xl dark:border-zinc-700 dark:bg-[#141414]">
        {/* Sidebar */}
        <aside className="hidden w-60 shrink-0 border-r-2 border-black dark:border-zinc-700 md:flex md:flex-col">
          <div className="border-b-2 border-black bg-black p-4 text-white">
            <h1 className="text-sm font-bold tracking-tight">Bate-papo</h1>
            <p className="mt-0.5 text-xs text-neutral-400">
              Salas e mensagens diretas
            </p>
          </div>

          <div className="thin-scroll flex-1 overflow-y-auto p-2">
            <p className="px-2 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-400">
              Salas
            </p>
            <div className="space-y-0.5">
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
                      "flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-colors",
                      selected
                        ? "bg-black text-white dark:bg-white dark:text-black"
                        : "text-neutral-600 hover:bg-neutral-100 hover:text-black dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white",
                      unread > 0 && !selected && "font-bold text-neutral-900 dark:text-zinc-100"
                    )}
                  >
                    <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate">
                      <Hash size={14} weight="bold" className="shrink-0 opacity-60" />
                      <span className="truncate">{ch.name}</span>
                    </span>
                    {ch.vipOnly && unread === 0 && (
                      <span
                        className={cn(
                          "shrink-0 text-[9px] font-semibold uppercase",
                          selected ? "opacity-80" : "text-neutral-400"
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

            <p className="mt-4 flex items-center gap-1.5 px-2 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-400">
              <ChatsCircle size={12} weight="bold" />
              Diretas
            </p>
            <div className="space-y-0.5">
              {dmPeers.length === 0 && (
                <p className="px-3 py-2 text-xs leading-relaxed text-neutral-400">
                  Nenhuma DM ainda. Use{" "}
                  <strong className="font-semibold text-neutral-500">
                    Conversar
                  </strong>{" "}
                  no match de mentorias.
                </p>
              )}
              {dmPeers.map(({ peer, channelId: cid }) => {
                const selected =
                  active.kind === "dm" && active.channelId === cid;
                const unread = unreadByChannel[cid] ?? 0;
                return (
                  <button
                    key={cid}
                    type="button"
                    onClick={() => openDm(peer.id)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors",
                      selected
                        ? "bg-black text-white dark:bg-white dark:text-black"
                        : "text-neutral-700 hover:bg-neutral-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    )}
                  >
                    <Avatar
                      name={peer.name}
                      src={peer.avatarUrl}
                      size="sm"
                      frame={peer.isVip ? peer.avatarFrame : null}
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "flex items-center gap-1 truncate text-sm",
                          unread > 0 ? "font-bold" : "font-semibold"
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
                          selected ? "opacity-70" : "text-neutral-400",
                          unread > 0 && !selected && "font-medium text-neutral-600 dark:text-zinc-300"
                        )}
                      >
                        {unread > 0
                          ? `${unread} nova${unread > 1 ? "s" : ""}`
                          : "Direct"}
                      </span>
                    </span>
                    <UnreadBadge count={unread} selected={selected} />
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Main */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-neutral-200/70 px-4 py-3 dark:border-zinc-800">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {active.kind === "dm" && dmPeer ? (
                  <Link
                    href={`/app/u/${dmPeer.id}`}
                    className="avatar-link shrink-0"
                  >
                    <Avatar
                      name={dmPeer.name}
                      src={dmPeer.avatarUrl}
                      size="sm"
                      frame={dmPeer.isVip ? dmPeer.avatarFrame : null}
                    />
                  </Link>
                ) : null}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-[13px] font-semibold tracking-[-0.02em] text-neutral-950 dark:text-zinc-100">
                      {headerTitle}
                    </h2>
                    {publicChannel?.vipOnly && <VipBadge />}
                    {active.kind === "dm" && (
                      <span className="shrink-0 rounded-md bg-neutral-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-neutral-600 dark:bg-zinc-800 dark:text-zinc-300">
                        DM
                      </span>
                    )}
                    {active.kind === "dm" && dmPeer?.isVerified && (
                      <VerifiedBadge size={14} />
                    )}
                  </div>
                  <p className="truncate text-xs text-neutral-400">{headerSub}</p>
                </div>
              </div>
            </div>
            {active.kind === "dm" && dmPeer && (
              <Link href={`/app/u/${dmPeer.id}`} className="shrink-0">
                <Button size="sm" variant="outline">
                  <UserCircle size={15} weight="bold" />
                  Perfil
                </Button>
              </Link>
            )}
          </div>

          {/* Mobile: salas + DMs */}
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
                    "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
                    selected
                      ? "bg-neutral-950 text-white dark:bg-white dark:text-black"
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
                          : "bg-[#25d366] text-white"
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
                    "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                    selected
                      ? "bg-neutral-950 text-white dark:bg-white dark:text-black"
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
                          : "bg-[#25d366] text-white"
                      )}
                    >
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

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
                className="thin-scroll flex-1 space-y-4 overflow-y-auto p-4"
                onScroll={(e) => {
                  const el = e.currentTarget;
                  const dist =
                    el.scrollHeight - el.scrollTop - el.clientHeight;
                  stickToBottomRef.current = dist < 80;
                }}
              >
                {active.kind === "dm" && channelMessages.length === 0 && (
                  <div className="mx-auto max-w-sm py-10 text-center">
                    <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-neutral-100 dark:bg-zinc-800">
                      {dmPeer ? (
                        <Avatar
                          name={dmPeer.name}
                          src={dmPeer.avatarUrl}
                          size="lg"
                        />
                      ) : null}
                    </div>
                    <p className="text-sm font-semibold text-[#1f1f1f] dark:text-zinc-100">
                      Direct com {dmPeer?.name ?? "usuário"}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                      Conversa privada. Envie a primeira mensagem para iniciar a
                      mentoria ou networking.
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
                    <p className="py-12 text-center text-sm text-neutral-400">
                      Nenhuma mensagem ainda. Comece a conversa.
                    </p>
                  )}
                <div ref={bottomRef} />
              </div>

              <ChatComposer
                placeholder={placeholder}
                disabled={dmBlocked || locked}
                onSend={onSend}
              />
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
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-neutral-400">
          Carregando chat…
        </div>
      }
    >
      <ChatPageInner />
    </Suspense>
  );
}
