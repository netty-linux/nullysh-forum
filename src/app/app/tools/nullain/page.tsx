"use client";

/**
 * Nullain Agent — portal de acesso (staff).
 * Visível a todos; liberado só para role admin.
 */

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import {
  NULLAIN_AGENT_LABEL,
  NULLAIN_AGENT_URL,
} from "@/lib/nullain-agent";
import { cn } from "@/lib/utils";
import {
  ArrowSquareOut,
  Brain,
  CircleNotch,
  Lightning,
  Lock,
  ShieldCheck,
  Sparkle,
  WaveSine,
} from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import Link from "next/link";

const CAPABILITIES = [
  {
    icon: Brain,
    title: "Raciocínio contextual",
    desc: "Entende o domínio Nullysh e responde com precisão operacional.",
  },
  {
    icon: Lightning,
    title: "Resposta em tempo real",
    desc: "Sessão dedicada no Railway, pronta para uso imediato da staff.",
  },
  {
    icon: WaveSine,
    title: "Fluxo de agente",
    desc: "Interface pensada para tarefas longas, prompts e iterações.",
  },
] as const;

export default function NullainAgentPage() {
  const { user, hydrated } = useAuth();
  const reduce = useReducedMotion();
  const isAdmin = user?.role === "admin";

  if (!hydrated || !user) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-[13px] text-[var(--text-tertiary)]">
        <CircleNotch size={16} className="animate-spin" aria-hidden />
        Carregando…
      </div>
    );
  }

  return (
    <div className="app-page mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      {/* Hero card */}
      <section
        className={cn(
          "relative overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)]",
          "bg-[var(--surface-elevated)] shadow-[var(--shadow-sm)]"
        )}
      >
        {/* Ambient AI mesh — só transform/opacity friendly, estático */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(99,102,241,0.14),transparent_55%),radial-gradient(ellipse_at_90%_20%,rgba(16,185,129,0.1),transparent_50%),linear-gradient(180deg,rgba(10,10,10,0.04)_0%,transparent_45%)] dark:bg-[radial-gradient(ellipse_at_20%_0%,rgba(129,140,248,0.18),transparent_55%),radial-gradient(ellipse_at_90%_20%,rgba(52,211,153,0.12),transparent_50%),linear-gradient(180deg,rgba(255,255,255,0.03)_0%,transparent_50%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-violet-500/10 blur-3xl dark:bg-violet-400/15"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -left-10 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl dark:bg-emerald-400/10"
        />

        <div
          className={cn(
            "relative p-6 sm:p-8",
            !isAdmin && "select-none"
          )}
        >
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            {/* Avatar + pulse */}
            <div className="relative mx-auto shrink-0 sm:mx-0">
              {!reduce && isAdmin && (
                <span
                  aria-hidden
                  className="absolute -inset-1 rounded-full bg-emerald-400/25 blur-[2px] [animation:fab-breathe_3.2s_ease-in-out_infinite]"
                />
              )}
              <div
                className={cn(
                  "relative h-20 w-20 overflow-hidden rounded-full ring-2 shadow-[var(--shadow-md)] sm:h-24 sm:w-24",
                  isAdmin
                    ? "ring-emerald-400/40"
                    : "ring-[var(--border)] opacity-45 grayscale"
                )}
              >
                <Image
                  src="/brand/nullain.png"
                  alt="Nullain Agent"
                  width={96}
                  height={96}
                  className="h-full w-full object-cover"
                  priority
                />
              </div>
              {isAdmin && (
                <span className="absolute bottom-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-[var(--surface-elevated)]">
                  <span className="sr-only">Online</span>
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1 text-center sm:text-left">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
                  <Sparkle size={11} weight="fill" aria-hidden />
                  Agente de IA
                </span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em]",
                    isAdmin
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                      : "bg-[var(--surface)] text-[var(--text-tertiary)]"
                  )}
                >
                  {isAdmin ? (
                    <>
                      <span
                        className="h-1.5 w-1.5 rounded-full bg-emerald-500"
                        aria-hidden
                      />
                      Online
                    </>
                  ) : (
                    <>
                      <Lock size={11} weight="bold" aria-hidden />
                      Staff only
                    </>
                  )}
                </span>
              </div>

              <h1
                className={cn(
                  "font-display mt-3 text-balance text-[var(--text-24)] font-semibold tracking-[-0.02em] sm:text-[var(--text-32)]",
                  isAdmin
                    ? "text-[var(--text-primary)]"
                    : "text-[var(--text-tertiary)]"
                )}
              >
                {NULLAIN_AGENT_LABEL}
              </h1>
              <p
                className={cn(
                  "mx-auto mt-2 max-w-xl text-[var(--text-15)] leading-relaxed sm:mx-0",
                  isAdmin
                    ? "text-[var(--text-secondary)]"
                    : "text-[var(--text-tertiary)]"
                )}
              >
                Seu copiloto operacional da plataforma. Planeje, diagnostique e
                execute com um agente dedicado — reservado à equipe
                administrativa do Nullysh Forum.
              </p>

              <div className="mt-5 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-start">
                {isAdmin ? (
                  <>
                    <a
                      href={NULLAIN_AGENT_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex"
                    >
                      <Button size="lg" className="w-full gap-2 sm:w-auto">
                        Abrir Nullain Agent
                        <ArrowSquareOut size={16} weight="bold" aria-hidden />
                      </Button>
                    </a>
                    <span className="text-center text-[13px] text-[var(--text-tertiary)] sm:text-left">
                      Abre em nova aba · sessão staff
                    </span>
                  </>
                ) : (
                  <div
                    className={cn(
                      "flex w-full flex-col items-center gap-3 rounded-[var(--radius-lg)] border border-dashed border-[var(--border)] bg-[var(--surface)]/60 px-4 py-4 sm:items-start"
                    )}
                    role="status"
                  >
                    <div className="flex items-center gap-2 text-[var(--text-tertiary)]">
                      <Lock size={18} weight="bold" aria-hidden />
                      <span className="text-[15px] font-medium">
                        Acesso bloqueado
                      </span>
                    </div>
                    <p className="max-w-[36ch] text-center text-[13px] leading-relaxed text-[var(--text-tertiary)] sm:text-left">
                      O Nullain Agent está disponível apenas para administradores
                      da plataforma. Membros veem a ferramenta em modo fantasma.
                    </p>
                    <Link href="/app" className="inline-flex">
                      <Button variant="outline" size="sm">
                        Voltar ao feed
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section
        className={cn("mt-6 grid gap-3 sm:grid-cols-3", !isAdmin && "opacity-40")}
        aria-hidden={!isAdmin}
      >
        {CAPABILITIES.map((cap, i) => {
          const Icon = cap.icon;
          return (
            <motion.article
              key={cap.title}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: reduce ? 0 : 0.05 * i,
                duration: 0.25,
                ease: [0.16, 1, 0.3, 1],
              }}
              className={cn(
                "rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface-elevated)] p-4",
                "shadow-[var(--shadow-sm)]"
              )}
            >
              <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] bg-[var(--surface)] text-[var(--text-primary)]">
                <Icon size={18} weight="duotone" aria-hidden />
              </div>
              <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--text-primary)]">
                {cap.title}
              </h2>
              <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-secondary)]">
                {cap.desc}
              </p>
            </motion.article>
          );
        })}
      </section>

      {/* Staff note */}
      <aside
        className={cn(
          "mt-6 flex gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)]/80 px-4 py-3",
          !isAdmin && "opacity-45"
        )}
      >
        <ShieldCheck
          size={20}
          weight="fill"
          className="mt-0.5 shrink-0 text-[var(--text-secondary)]"
          aria-hidden
        />
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-[var(--text-primary)]">
            Ferramenta da categoria Staff · Ferramentas
          </p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-[var(--text-secondary)]">
            Visível no menu para toda a comunidade; execução liberada somente
            para contas com papel{" "}
            <span className="font-medium text-[var(--text-primary)]">admin</span>
            .
          </p>
        </div>
      </aside>
    </div>
  );
}
