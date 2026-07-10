"use client";

import { ChatFab } from "@/components/chat-fab";
import { ComposeFab } from "@/components/compose-fab";
import { FabShell } from "@/components/fab-shell";
import {
  answerNullain,
  NULLAIN_QUICK_PROMPTS,
  NULLAIN_WELCOME,
  nullainMsgId,
  type NullainMsg,
} from "@/lib/nullain-kb";
import { cn } from "@/lib/utils";
import {
  PaperPlaneTilt,
  Sparkle,
  X,
} from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import {
  FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";

function renderRich(text: string) {
  // Negrito simples **texto**
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-inherit">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export function NullainAssistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [messages, setMessages] = useState<NullainMsg[]>(() => [
    {
      id: "welcome",
      role: "assistant",
      content: NULLAIN_WELCOME,
      createdAt: new Date().toISOString(),
    },
  ]);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 120);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, typing, open]);

  function pushUserAndReply(text: string) {
    const q = text.trim();
    if (!q || typing) return;

    const userMsg: NullainMsg = {
      id: nullainMsgId(),
      role: "user",
      content: q,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setTyping(true);

    const delay = reduce ? 200 : 450 + Math.min(900, q.length * 12);
    window.setTimeout(() => {
      const reply: NullainMsg = {
        id: nullainMsgId(),
        role: "assistant",
        content: answerNullain(q),
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, reply]);
      setTyping(false);
    }, delay);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    pushUserAndReply(input);
  }

  return (
    /*
     * Âncora fixa no canto: só a coluna de FABs ocupa o fluxo.
     * O chat é position:absolute — NÃO entra no flex, então os ícones
     * nunca saem do lugar ao abrir/fechar.
     */
    <div
      className={cn(
        "pointer-events-none fixed bottom-5 right-5 z-[60]",
        "sm:bottom-6 sm:right-6"
      )}
    >
      {/* Coluna dos FABs — Direct · + · Nullain (gap maior p/ sombra no hover) */}
      <div className="relative flex flex-col items-center gap-3.5 sm:gap-4">
        <ChatFab />
        <ComposeFab />

        <div className="relative">
          {/* pulse discreto só quando fechado — atrás do shell */}
          {!open && !reduce && (
            <span
              aria-hidden
              className="pointer-events-none absolute -inset-1 rounded-full bg-black/15 blur-[2px] [animation:fab-breathe_3.2s_ease-in-out_infinite]"
            />
          )}
          <FabShell
            label={open ? "Fechar Nullain" : "Abrir assistente Nullain"}
            title="Nullain — assistente IA"
            active={open}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            media={
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src="/brand/nullain.png"
                alt=""
                width={56}
                height={56}
                className="h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/fab:scale-110"
                draggable={false}
              />
            }
          >
            {/* badge fechar quando aberto */}
            {open ? (
              <span className="absolute -right-0.5 -top-0.5 z-[3] flex h-5 w-5 items-center justify-center rounded-full bg-black text-white shadow-[0_2px_8px_rgb(0_0_0/0.4)] ring-2 ring-white/90">
                <X size={11} weight="bold" />
              </span>
            ) : (
              <span className="sr-only">Nullain</span>
            )}
          </FabShell>
        </div>

        {/*
          Painel do chat — absolute, fora do fluxo.
          • Desktop: à ESQUERDA da coluna de FABs (mesmo bottom)
          • Mobile: ACIMA dos FABs (right alinhado), sem empurrar os ícones
        */}
        <AnimatePresence>
          {open && (
            <motion.div
              key="nullain-panel"
              role="dialog"
              aria-label="Chat com Nullain"
              initial={
                reduce
                  ? { opacity: 0 }
                  : { opacity: 0, y: 10, scale: 0.98 }
              }
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={
                reduce
                  ? { opacity: 0 }
                  : { opacity: 0, y: 8, scale: 0.98 }
              }
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className={cn(
                "pointer-events-auto absolute z-10 flex flex-col overflow-hidden",
                "rounded-2xl border border-neutral-200/90 bg-white",
                "shadow-[0_16px_48px_-12px_rgb(0_0_0/0.35)]",
                "dark:border-zinc-700 dark:bg-[#141414]",
                // tamanho
                "h-[min(520px,calc(100dvh-8.5rem))] w-[min(100vw-1.5rem,380px)]",
                // mobile: acima da coluna de FABs, ancorado à direita
                "bottom-[calc(100%+0.75rem)] right-0",
                // desktop: ao lado esquerdo dos ícones, alinhado embaixo
                "sm:bottom-0 sm:right-[calc(100%+0.75rem)] sm:h-[min(560px,calc(100dvh-3rem))]"
              )}
            >
              {/* Header */}
              <div className="relative flex shrink-0 items-center gap-3 border-b border-white/10 bg-[#0a0a0a] px-4 py-3 text-white">
                <div
                  aria-hidden
                  className="pointer-events-none absolute -left-6 -top-8 h-24 w-24 rounded-full bg-white/10 blur-2xl"
                />
                <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full ring-2 ring-white/25 shadow-lg">
                  <Image
                    src="/brand/nullain.png"
                    alt="Nullain"
                    width={44}
                    height={44}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="relative min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-sm font-semibold tracking-tight">
                    Nullain
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-white/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/90">
                      <Sparkle size={10} weight="fill" />
                      IA
                    </span>
                  </p>
                  <p className="truncate text-[11px] text-white/55">
                    Assistente da Nullysh Forum · sempre online
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl text-white/70 transition hover:bg-white/10 hover:text-white"
                  aria-label="Fechar chat da Nullain"
                >
                  <X size={18} weight="bold" />
                </button>
              </div>

              {/* Messages */}
              <div
                ref={listRef}
                className="thin-scroll flex-1 space-y-3 overflow-y-auto bg-neutral-50/80 px-3 py-3 dark:bg-[#0e0e0e]"
              >
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      "flex gap-2",
                      m.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    {m.role === "assistant" && (
                      <div className="mt-0.5 h-7 w-7 shrink-0 overflow-hidden rounded-full ring-1 ring-black/10 dark:ring-white/10">
                        <Image
                          src="/brand/nullain.png"
                          alt=""
                          width={28}
                          height={28}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    )}
                    <div
                      className={cn(
                        "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-[13px] leading-relaxed",
                        m.role === "user"
                          ? "rounded-br-md bg-[#0a0a0a] text-white"
                          : "rounded-bl-md border border-neutral-200/80 bg-white text-neutral-700 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                      )}
                    >
                      {renderRich(m.content)}
                    </div>
                  </div>
                ))}

                {typing && (
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full ring-1 ring-black/10">
                      <Image
                        src="/brand/nullain.png"
                        alt=""
                        width={28}
                        height={28}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="inline-flex items-center gap-1 rounded-2xl rounded-bl-md border border-neutral-200 bg-white px-3 py-2.5 dark:border-zinc-700 dark:bg-zinc-900">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-neutral-400" />
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-neutral-400 [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-neutral-400 [animation-delay:300ms]" />
                    </div>
                  </div>
                )}

                {messages.length <= 2 && !typing && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {NULLAIN_QUICK_PROMPTS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => pushUserAndReply(p)}
                        className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-neutral-600 transition hover:border-[#1f1f1f] hover:text-[#1f1f1f] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-500"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Input */}
              <form
                onSubmit={onSubmit}
                className="flex shrink-0 items-center gap-2 border-t border-neutral-200/80 bg-white p-2.5 dark:border-zinc-800 dark:bg-[#141414]"
              >
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Pergunte à Nullain…"
                  disabled={typing}
                  className="h-10 flex-1 rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:bg-white focus:outline-none focus:ring-[3px] focus:ring-neutral-900/8 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || typing}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#0a0a0a] text-white transition hover:bg-black disabled:opacity-40 dark:bg-white dark:text-black"
                  aria-label="Enviar mensagem"
                >
                  <PaperPlaneTilt size={16} weight="fill" />
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
