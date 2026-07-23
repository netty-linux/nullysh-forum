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
  ArrowRight,
  ArrowSquareOut,
  Brain,
  CircleNotch,
  Cpu,
  Lightning,
  Lock,
  Robot,
  ShieldCheck,
  Sparkle,
  TerminalWindow,
  WaveSine,
} from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import Link from "next/link";

const CAPABILITIES = [
  {
    icon: Brain,
    title: "Raciocínio Contextual",
    desc: "Entende o domínio Nullysh, estrutura de dados e responde com precisão operacional.",
    accent: "text-violet-500 bg-violet-500/10 dark:bg-violet-500/20",
  },
  {
    icon: Lightning,
    title: "Execução em Tempo Real",
    desc: "Sessão de alta performance hospedada no Railway pronta para uso imediato.",
    accent: "text-amber-500 bg-amber-500/10 dark:bg-amber-500/20",
  },
  {
    icon: WaveSine,
    title: "Workflows Autônomos",
    desc: "Interface projetada para tarefas longas, prompts estruturados e iterações complexas.",
    accent: "text-sky-500 bg-sky-500/10 dark:bg-sky-500/20",
  },
  {
    icon: TerminalWindow,
    title: "Comandos & Diagnósticos",
    desc: "Executa rotinas internas, auditorias de sistema e automação para a equipe staff.",
    accent: "text-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/20",
  },
] as const;

export default function NullainAgentPage() {
  const { user, hydrated } = useAuth();
  const reduce = useReducedMotion();
  const isAdmin = user?.role === "admin";

  if (!hydrated || !user) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-xs text-neutral-400">
        <CircleNotch size={18} className="animate-spin text-violet-500" aria-hidden />
        Iniciando Nullain Agent OS…
      </div>
    );
  }

  return (
    <div className="app-page mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      {/* Header section */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-200/80 bg-violet-50/80 px-3 py-1 text-[12px] font-semibold text-violet-900 dark:border-violet-900/50 dark:bg-violet-950/40 dark:text-violet-300 mb-3">
            <Robot size={15} weight="fill" />
            Agente de Inteligência Artificial Autônomo
          </div>
          <h1 className="font-display text-[1.75rem] font-semibold tracking-tight text-[#1f1f1f] dark:text-zinc-50 sm:text-[2.25rem]">
            {NULLAIN_AGENT_LABEL}
          </h1>
          <p className="mt-2 max-w-[55ch] text-[14px] leading-relaxed text-neutral-500 dark:text-zinc-400">
            Seu copiloto operacional e assistente avançado do Nullysh Forum. Planejamento, diagnósticos e automação em tempo real.
          </p>
        </div>
      </div>

      {/* Hero Console Card */}
      <section
        className={cn(
          "relative overflow-hidden rounded-3xl border border-neutral-200/90 bg-white shadow-xl dark:border-zinc-800 dark:bg-[#141414]",
          "transition-all duration-300"
        )}
      >
        {/* Ambient AI Background Effects */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(139,92,246,0.12),transparent_55%),radial-gradient(ellipse_at_90%_20%,rgba(16,185,129,0.1),transparent_50%)] dark:bg-[radial-gradient(ellipse_at_20%_0%,rgba(139,92,246,0.2),transparent_55%),radial-gradient(ellipse_at_90%_20%,rgba(16,185,129,0.12),transparent_50%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-violet-500/10 blur-3xl dark:bg-violet-500/20"
        />

        <div
          className={cn(
            "relative p-6 sm:p-8 md:p-10",
            !isAdmin && "select-none"
          )}
        >
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            {/* Avatar with pulse ring */}
            <div className="relative mx-auto shrink-0 sm:mx-0">
              {!reduce && isAdmin && (
                <span
                  aria-hidden
                  className="absolute -inset-1 rounded-full bg-emerald-500/30 blur-sm animate-pulse"
                />
              )}
              <div
                className={cn(
                  "relative h-24 w-24 overflow-hidden rounded-full ring-4 shadow-lg sm:h-28 sm:w-28",
                  isAdmin
                    ? "ring-emerald-500/40"
                    : "ring-neutral-200 opacity-50 grayscale dark:ring-zinc-800"
                )}
              >
                <Image
                  src="/brand/nullain.jpeg"
                  alt="Nullain Agent"
                  width={112}
                  height={112}
                  className="h-full w-full object-cover"
                  priority
                />
              </div>
              {isAdmin && (
                <span className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#141414]">
                  <span className="h-2 w-2 rounded-full bg-white" />
                </span>
              )}
            </div>

            {/* Agent Info & Controls */}
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <span className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-100/80 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-neutral-700 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-300">
                  <Sparkle size={12} weight="fill" className="text-violet-500" />
                  Agente Autônomo
                </span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider",
                    isAdmin
                      ? "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                      : "bg-neutral-100 text-neutral-500 dark:bg-zinc-800 dark:text-zinc-400"
                  )}
                >
                  {isAdmin ? (
                    <>
                      <Cpu size={12} weight="fill" className="text-emerald-500" />
                      Sistema Online
                    </>
                  ) : (
                    <>
                      <Lock size={12} weight="bold" />
                      Staff Exclusivo
                    </>
                  )}
                </span>
              </div>

              <h2
                className={cn(
                  "font-display mt-3 text-balance text-2xl font-bold tracking-tight sm:text-3xl",
                  isAdmin
                    ? "text-[#1f1f1f] dark:text-zinc-50"
                    : "text-neutral-400 dark:text-zinc-600"
                )}
              >
                {NULLAIN_AGENT_LABEL}
              </h2>

              <p
                className={cn(
                  "mx-auto mt-2 max-w-xl text-xs sm:text-sm leading-relaxed sm:mx-0",
                  isAdmin
                    ? "text-neutral-600 dark:text-zinc-400"
                    : "text-neutral-400 dark:text-zinc-600"
                )}
              >
                Seu copiloto operacional da plataforma. Planeje, diagnostique e execute automações com um agente dedicado — reservado à equipe administrativa do Nullysh Forum.
              </p>

              <div className="mt-6 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-start">
                {isAdmin ? (
                  <>
                    <a
                      href={NULLAIN_AGENT_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex"
                    >
                      <Button
                        size="lg"
                        className="h-12 w-full gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-7 font-semibold text-white shadow-lg transition-all hover:from-violet-500 hover:to-indigo-500 hover:scale-[1.02] sm:w-auto"
                      >
                        Abrir Nullain Agent
                        <ArrowSquareOut size={18} weight="bold" />
                      </Button>
                    </a>
                    <span className="text-center text-xs text-neutral-400 sm:text-left">
                      Abre em nova aba · Sessão Staff Autenticada
                    </span>
                  </>
                ) : (
                  <div
                    className="flex w-full flex-col items-center gap-3 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50/80 p-5 dark:border-zinc-800 dark:bg-zinc-900/40 sm:items-start"
                    role="status"
                  >
                    <div className="flex items-center gap-2 text-neutral-500 dark:text-zinc-400">
                      <Lock size={18} weight="bold" />
                      <span className="text-sm font-semibold">
                        Acesso Restrito ao Staff
                      </span>
                    </div>
                    <p className="max-w-md text-center text-xs leading-relaxed text-neutral-500 dark:text-zinc-400 sm:text-left">
                      O Nullain Agent é uma ferramenta reservada exclusivamente aos administradores da plataforma.
                    </p>
                    <Link href="/app" className="inline-flex">
                      <Button variant="outline" size="sm" className="rounded-full">
                        Voltar ao Feed <ArrowRight size={12} className="ml-1" />
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Live Technical Specs Panel (Admin Only) */}
        {isAdmin && (
          <div className="border-t border-neutral-100 bg-neutral-50/80 p-4 px-6 dark:border-zinc-800/80 dark:bg-zinc-900/40">
            <div className="grid gap-4 text-xs font-mono sm:grid-cols-4">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-neutral-400 dark:text-zinc-500">Status:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">Online & Ativo</span>
              </div>
              <div>
                <span className="text-neutral-400 dark:text-zinc-500">Ambiente:</span>{" "}
                <span className="font-semibold text-neutral-800 dark:text-zinc-200">Railway Dedicated</span>
              </div>
              <div>
                <span className="text-neutral-400 dark:text-zinc-500">Permissão:</span>{" "}
                <span className="font-semibold text-violet-600 dark:text-violet-400">Admin Root</span>
              </div>
              <div>
                <span className="text-neutral-400 dark:text-zinc-500">Latência:</span>{" "}
                <span className="font-semibold text-neutral-800 dark:text-zinc-200">&lt; 120ms</span>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Capabilities Section */}
      <div className="mt-10">
        <h2 className="mb-4 font-display text-base font-semibold tracking-tight text-[#1f1f1f] dark:text-zinc-50">
          Capacidade & Recursos do Agente
        </h2>

        <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-4", !isAdmin && "opacity-50")}>
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
                className="group relative flex flex-col justify-between rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-md dark:border-zinc-800 dark:bg-[#141414] dark:hover:border-zinc-700"
              >
                <div>
                  <div className={`mb-3.5 inline-flex h-11 w-11 items-center justify-center rounded-xl transition-transform group-hover:scale-105 ${cap.accent}`}>
                    <Icon size={22} weight="fill" />
                  </div>
                  <h3 className="font-display text-sm font-semibold tracking-tight text-[#1f1f1f] dark:text-zinc-50">
                    {cap.title}
                  </h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-neutral-600 dark:text-zinc-400">
                    {cap.desc}
                  </p>
                </div>
              </motion.article>
            );
          })}
        </div>
      </div>

      {/* Staff Policy Note */}
      <aside
        className={cn(
          "mt-8 flex items-start gap-3 rounded-2xl border border-neutral-200/80 bg-neutral-50/80 p-4 dark:border-zinc-800/80 dark:bg-[#141414]/60",
          !isAdmin && "opacity-50"
        )}
      >
        <ShieldCheck
          size={20}
          weight="fill"
          className="mt-0.5 shrink-0 text-violet-500"
        />
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[#1f1f1f] dark:text-zinc-100">
            Política de Execução & Segurança Staff
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-neutral-500 dark:text-zinc-400">
            Ferramenta visível no catálogo de tools da plataforma; a execução de agentes e comandos autônomos é liberada exclusivamente para contas com papel de <span className="font-medium text-neutral-900 dark:text-zinc-200">administrador</span>.
          </p>
        </div>
      </aside>
    </div>
  );
}

