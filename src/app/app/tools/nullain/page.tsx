"use client";

/**
 * Nullain Agent — portal de acesso (staff).
 * Visível a todos; liberado só para role admin.
 *
 * Layout alinhado à nova identidade da Nullain: pixel art monocromática,
 * superfícies em camadas e zero cor decorativa (verde só como sinal de status).
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
  Lightning,
  Lock,
  ShieldCheck,
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
  },
  {
    icon: Lightning,
    title: "Execução em Tempo Real",
    desc: "Sessão de alta performance hospedada no Railway pronta para uso imediato.",
  },
  {
    icon: WaveSine,
    title: "Workflows Autônomos",
    desc: "Interface projetada para tarefas longas, prompts estruturados e iterações complexas.",
  },
  {
    icon: TerminalWindow,
    title: "Comandos & Diagnósticos",
    desc: "Executa rotinas internas, auditorias de sistema e automação para a equipe staff.",
  },
] as const;

const SPECS = [
  { label: "Ambiente", value: "Railway Dedicated" },
  { label: "Permissão", value: "Admin Root" },
  { label: "Latência", value: "< 120ms" },
] as const;

const BRIEFING = [
  "Planeja e executa rotinas operacionais da plataforma.",
  "Audita dados, integrações e saúde dos serviços.",
  "Opera em sessão dedicada, isolada do feed público.",
] as const;

export default function NullainAgentPage() {
  const { user, hydrated } = useAuth();
  const reduce = useReducedMotion();
  const isAdmin = user?.role === "admin";

  if (!hydrated || !user) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-[13px] text-neutral-400">
        <CircleNotch size={18} className="animate-spin" aria-hidden />
        Iniciando Nullain Agent OS…
      </div>
    );
  }

  return (
    <div className="app-page mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      {/* ── Cabeçalho ───────────────────────────────────────── */}
      <header className="mb-6">
        <p className="font-mono text-[13px] uppercase tracking-[0.14em] text-neutral-400 dark:text-zinc-500">
          Nullysh / Tools / Agent
        </p>
        <h1 className="font-display mt-2 text-[24px] font-semibold tracking-[-0.02em] text-[#1f1f1f] dark:text-zinc-50 sm:text-[32px]">
          {NULLAIN_AGENT_LABEL}
        </h1>
        <p className="mt-2 max-w-[55ch] text-balance text-[15px] leading-relaxed text-neutral-500 dark:text-zinc-400">
          Copiloto operacional do Nullysh Forum. Planejamento, diagnósticos e
          automação em tempo real — reservado à equipe administrativa.
        </p>
      </header>

      {/* ── Card principal: banner + identidade ─────────────── */}
      <section className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#141414]">
        {/* Banner pixel art — fundo preto nativo do asset, sem crop */}
        <div className="relative aspect-[16/9] w-full bg-[#0b0b0b] sm:aspect-[2/1] md:aspect-[21/9]">
          <Image
            src="/brand/nullain/banner.png"
            alt="Nullain Agent — banner da identidade visual"
            fill
            sizes="(max-width: 1024px) 100vw, 1024px"
            className={cn(
              "pixel-art object-contain",
              !isAdmin && "opacity-40 grayscale"
            )}
            priority
          />
          {/* Chip de status ancorado no banner */}
          <div className="absolute left-4 top-4 sm:left-5 sm:top-5">
            <span
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[13px] backdrop-blur",
                isAdmin
                  ? "border-white/15 bg-black/50 text-white/80"
                  : "border-white/10 bg-black/50 text-white/50"
              )}
            >
              {isAdmin ? (
                <>
                  <span className="relative flex h-1.5 w-1.5">
                    {!reduce && (
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70" />
                    )}
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  </span>
                  ONLINE
                </>
              ) : (
                <>
                  <Lock size={12} weight="bold" />
                  RESTRITO
                </>
              )}
            </span>
          </div>
        </div>

        {/* Identidade + CTA */}
        <div className="border-t border-neutral-200/80 p-5 dark:border-zinc-800 sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            {/* Avatar pixel — quadrado arredondado respeita a grade do sprite */}
            <div
              className={cn(
                "relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border bg-white dark:bg-[#0b0b0b] sm:h-24 sm:w-24",
                isAdmin
                  ? "border-neutral-200 dark:border-zinc-700"
                  : "border-neutral-200 opacity-50 grayscale dark:border-zinc-800"
              )}
            >
              <Image
                src="/brand/nullain/avatar.png"
                alt=""
                fill
                sizes="96px"
                className="pixel-art object-cover"
              />
            </div>

            <div className="min-w-0 flex-1">
              <h2
                className={cn(
                  "font-display text-[20px] font-semibold tracking-[-0.01em]",
                  isAdmin
                    ? "text-[#1f1f1f] dark:text-zinc-50"
                    : "text-neutral-400 dark:text-zinc-600"
                )}
              >
                {NULLAIN_AGENT_LABEL}
              </h2>
              <p className="mt-1 text-[14px] leading-relaxed text-neutral-500 dark:text-zinc-400">
                Agente autônomo · Sessão staff autenticada
              </p>
            </div>

            {isAdmin ? (
              <a
                href={NULLAIN_AGENT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0"
              >
                <Button
                  size="lg"
                  className="h-11 w-full gap-2 rounded-xl px-6 text-[15px] font-medium sm:w-auto"
                >
                  Abrir Agent
                  <ArrowSquareOut size={16} weight="bold" />
                </Button>
              </a>
            ) : (
              <Link href="/app" className="shrink-0">
                <Button
                  variant="outline"
                  size="lg"
                  className="h-11 w-full gap-2 rounded-xl px-6 text-[15px] font-medium sm:w-auto"
                >
                  Voltar ao Feed
                  <ArrowRight size={16} weight="bold" />
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Specs técnicas (admin) */}
        {isAdmin && (
          <dl className="grid grid-cols-1 gap-3 border-t border-neutral-200/80 bg-neutral-50/60 px-5 py-4 font-mono text-[13px] dark:border-zinc-800 dark:bg-zinc-900/40 sm:grid-cols-3 sm:px-6">
            {SPECS.map((spec) => (
              <div key={spec.label} className="flex items-center gap-2">
                <dt className="text-neutral-400 dark:text-zinc-500">
                  {spec.label}:
                </dt>
                <dd className="font-medium text-neutral-800 dark:text-zinc-200">
                  {spec.value}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      {/* ── Briefing: ilustração + resumo operacional ────────── */}
      <section
        className={cn(
          "mt-6 overflow-hidden rounded-2xl border border-neutral-200/90 bg-white dark:border-zinc-800 dark:bg-[#141414]",
          !isAdmin && "opacity-60"
        )}
      >
        <div className="grid items-stretch gap-0 sm:grid-cols-[220px_1fr]">
          {/* Sketch full-body — line art invertida no dark */}
          <div className="relative flex items-end justify-center border-neutral-200/80 bg-neutral-50/60 px-4 pt-6 dark:border-zinc-800 dark:bg-zinc-900/40 sm:border-r">
            <div className="relative h-52 w-full sm:h-64">
              <Image
                src="/brand/nullain/agent-full.png"
                alt="Ilustração da agente Nullain"
                fill
                sizes="220px"
                className="object-contain object-bottom dark:invert"
              />
            </div>
          </div>

          <div className="p-5 sm:p-6">
            <h3 className="font-display text-[16px] font-semibold tracking-[-0.01em] text-[#1f1f1f] dark:text-zinc-50">
              O que a Nullain faz
            </h3>
            <ul className="mt-3 space-y-2.5">
              {BRIEFING.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2.5 text-[14px] leading-relaxed text-neutral-600 dark:text-zinc-400"
                >
                  <span
                    aria-hidden
                    className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-neutral-400 dark:bg-zinc-600"
                  />
                  {item}
                </li>
              ))}
            </ul>

            <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-neutral-200/80 bg-neutral-50/60 p-3.5 dark:border-zinc-800 dark:bg-zinc-900/40">
              <ShieldCheck
                size={18}
                weight="fill"
                className="mt-0.5 shrink-0 text-neutral-400 dark:text-zinc-500"
              />
              <p className="text-[13px] leading-relaxed text-neutral-500 dark:text-zinc-400">
                Ferramenta visível no catálogo da plataforma; a execução de
                agentes e comandos autônomos é liberada exclusivamente para
                contas com papel de{" "}
                <span className="font-medium text-neutral-800 dark:text-zinc-200">
                  administrador
                </span>
                .
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Capacidades ─────────────────────────────────────── */}
      <div className="mt-8">
        <h2 className="mb-3 font-display text-[16px] font-semibold tracking-[-0.01em] text-[#1f1f1f] dark:text-zinc-50">
          Capacidade & Recursos
        </h2>

        <div
          className={cn(
            "grid gap-3 sm:grid-cols-2 lg:grid-cols-4",
            !isAdmin && "opacity-60"
          )}
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
                className="rounded-2xl border border-neutral-200/90 bg-white p-4 transition-colors duration-200 hover:border-neutral-300 hover:bg-neutral-50/60 dark:border-zinc-800 dark:bg-[#141414] dark:hover:border-zinc-700 dark:hover:bg-zinc-900/40"
              >
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-100 text-neutral-700 dark:bg-zinc-800 dark:text-zinc-300">
                  <Icon size={18} weight="regular" />
                </div>
                <h3 className="font-display mt-3 text-[14px] font-medium tracking-[-0.01em] text-[#1f1f1f] dark:text-zinc-50">
                  {cap.title}
                </h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-500 dark:text-zinc-400">
                  {cap.desc}
                </p>
              </motion.article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
