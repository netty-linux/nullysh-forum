"use client";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { VipGate, VipBadge } from "@/components/vip-gate";
import { useAuth } from "@/hooks/use-auth";
import { chatChannels } from "@/lib/mock-data";
import { useForumStore } from "@/lib/forum-store";
import { formatRelative } from "@/lib/utils";
import { PaperPlaneTilt } from "@phosphor-icons/react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

export default function ChatPage() {
  const { user, isVip } = useAuth();
  const messages = useForumStore((s) => s.messages);
  const sendMessage = useForumStore((s) => s.sendMessage);
  const [channelId, setChannelId] = useState(chatChannels[0].id);
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const channel = chatChannels.find((c) => c.id === channelId)!;
  const locked = channel.vipOnly && !isVip;

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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [channelMessages.length, channelId]);

  function onSend(e: FormEvent) {
    e.preventDefault();
    if (!user || locked || !text.trim()) return;
    sendMessage({
      channelId,
      authorId: user.id,
      authorName: user.name,
      authorAvatar: user.avatar,
      content: text,
    });
    setText("");
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-3.5rem)] max-w-5xl flex-col px-0 sm:h-[100dvh] sm:px-6 sm:py-6 lg:h-[100dvh]">
      <div className="flex min-h-0 flex-1 overflow-hidden border-neutral-200/80 bg-white sm:rounded-2xl sm:border">
        {/* Channels */}
        <aside className="hidden w-56 shrink-0 border-r border-neutral-200/80 md:block">
          <div className="border-b border-neutral-200/80 p-4">
            <h1 className="text-sm font-semibold text-neutral-950">Bate-papo</h1>
            <p className="mt-0.5 text-xs text-neutral-400">Salas da comunidade</p>
          </div>
          <div className="space-y-0.5 p-2">
            {chatChannels.map((ch) => (
              <button
                key={ch.id}
                type="button"
                onClick={() => setChannelId(ch.id)}
                className={
                  channelId === ch.id
                    ? "flex w-full items-center justify-between rounded-xl bg-neutral-950 px-3 py-2.5 text-left text-sm text-white"
                    : "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm text-neutral-600 hover:bg-neutral-100"
                }
              >
                <span className="truncate">#{ch.name}</span>
                {ch.vipOnly && (
                  <span
                    className={
                      channelId === ch.id
                        ? "text-[9px] font-semibold uppercase opacity-80"
                        : "text-[9px] font-semibold uppercase text-neutral-400"
                    }
                  >
                    VIP
                  </span>
                )}
              </button>
            ))}
          </div>
        </aside>

        {/* Main chat */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-neutral-200/80 px-4 py-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-neutral-950">
                  #{channel.name}
                </h2>
                {channel.vipOnly && <VipBadge />}
              </div>
              <p className="text-xs text-neutral-400">{channel.description}</p>
            </div>
          </div>

          {/* Mobile channel pills */}
          <div className="flex gap-2 overflow-x-auto border-b border-neutral-100 px-4 py-2 md:hidden">
            {chatChannels.map((ch) => (
              <button
                key={ch.id}
                type="button"
                onClick={() => setChannelId(ch.id)}
                className={
                  channelId === ch.id
                    ? "shrink-0 rounded-full bg-neutral-950 px-3 py-1 text-xs font-medium text-white"
                    : "shrink-0 rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600"
                }
              >
                #{ch.name}
              </button>
            ))}
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
              <div className="thin-scroll flex-1 space-y-4 overflow-y-auto p-4">
                {channelMessages.map((m) => (
                  <div key={m.id} className="flex gap-3">
                    <Avatar name={m.authorAvatar || m.authorName} size="sm" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="text-sm font-medium text-neutral-950">
                          {m.authorName}
                        </span>
                        <span className="text-[11px] text-neutral-400">
                          {formatRelative(m.createdAt)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm leading-relaxed text-neutral-600">
                        {m.content}
                      </p>
                    </div>
                  </div>
                ))}
                {channelMessages.length === 0 && (
                  <p className="py-12 text-center text-sm text-neutral-400">
                    Nenhuma mensagem ainda. Comece a conversa.
                  </p>
                )}
                <div ref={bottomRef} />
              </div>

              <form
                onSubmit={onSend}
                className="flex items-center gap-2 border-t border-neutral-200/80 p-3"
              >
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={`Mensagem em #${channel.name}`}
                  className="h-11 flex-1 rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 text-sm text-neutral-950 placeholder:text-neutral-400 focus:border-neutral-950 focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-950/10"
                />
                <Button type="submit" size="icon" disabled={!text.trim()}>
                  <PaperPlaneTilt size={18} weight="fill" />
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
