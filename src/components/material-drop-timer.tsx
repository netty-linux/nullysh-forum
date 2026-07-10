"use client";

import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { ClockCountdown, CrownSimple, Gift } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

/** Ciclo free: 24h · VIP: 6h (aviso + countdown alinhado ao plano) */
const FREE_CYCLE_MS = 24 * 60 * 60 * 1000;
const VIP_CYCLE_MS = 6 * 60 * 60 * 1000;

/** Âncora fixa para ciclos determinísticos entre reloads */
const EPOCH = Date.UTC(2026, 0, 1, 0, 0, 0);

function msUntilNextDrop(cycleMs: number, now: number): number {
  const elapsed = Math.max(0, now - EPOCH);
  const intoCycle = elapsed % cycleMs;
  return cycleMs - intoCycle;
}

function formatCountdown(ms: number): {
  hours: string;
  minutes: string;
  seconds: string;
} {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return {
    hours: String(h).padStart(2, "0"),
    minutes: String(m).padStart(2, "0"),
    seconds: String(s).padStart(2, "0"),
  };
}

function DigitBlock({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className={cn(
          "inline-flex min-w-[2.75rem] items-center justify-center rounded-lg",
          "bg-white/10 px-2 py-1.5 font-mono text-xl font-bold tabular-nums tracking-tight text-white",
          "ring-1 ring-white/15 sm:min-w-[3.25rem] sm:text-2xl"
        )}
      >
        {value}
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/50">
        {label}
      </span>
    </div>
  );
}

/**
 * Badge de drop de materiais — fundo preto, texto branco, blur no fundo.
 * Free: drop a cada 24h · VIP: a cada 6h.
 */
export function MaterialDropTimer({ className }: { className?: string }) {
  const { isVip } = useAuth();
  const cycleMs = isVip ? VIP_CYCLE_MS : FREE_CYCLE_MS;
  const [remaining, setRemaining] = useState(() =>
    msUntilNextDrop(cycleMs, Date.now())
  );

  useEffect(() => {
    setRemaining(msUntilNextDrop(cycleMs, Date.now()));
    const id = window.setInterval(() => {
      setRemaining(msUntilNextDrop(cycleMs, Date.now()));
    }, 1000);
    return () => window.clearInterval(id);
  }, [cycleMs]);

  const { hours, minutes, seconds } = formatCountdown(remaining);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl",
        "border border-white/10 bg-[#0a0a0a] text-white",
        "shadow-[0_8px_32px_-8px_rgb(0_0_0/0.45)]",
        className
      )}
    >
      {/* Blur orbs de fundo */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-10 -top-12 h-40 w-40 rounded-full bg-white/15 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-16 -right-8 h-44 w-44 rounded-full bg-sky-500/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[#0a0a0a]/55 backdrop-blur-xl"
      />

      <div className="relative z-10 flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:p-6">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-white ring-1 ring-white/15">
              <Gift size={13} weight="fill" className="text-white" />
              Drop de materiais
            </span>
            {isVip ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#ffffff] px-2 py-0.5 text-[10px] font-bold tracking-wide text-[#0a0a0a]">
                <CrownSimple size={11} weight="fill" />
                VIP · 6h
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold tracking-wide text-white/80 ring-1 ring-white/15">
                Free · 24h
              </span>
            )}
          </div>

          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-white sm:text-base">
              <ClockCountdown size={18} weight="bold" className="shrink-0" />
              {isVip
                ? "Próximo material VIP em"
                : "Próximo material free em"}
            </p>
            <p className="mt-1.5 max-w-md text-xs leading-relaxed text-white/65 sm:text-[13px]">
              {isVip ? (
                <>
                  Como VIP, um material novo dropa a cada{" "}
                  <strong className="font-semibold text-white">6 horas</strong>.
                  Membros free recebem um drop a cada{" "}
                  <strong className="font-semibold text-white">24 horas</strong>.
                </>
              ) : (
                <>
                  A cada{" "}
                  <strong className="font-semibold text-white">24 horas</strong>{" "}
                  dropa um material novo para membros free.{" "}
                  <span className="text-white/90">
                    VIPs recebem drops a cada 6 horas
                  </span>
                  .
                </>
              )}
            </p>
          </div>
        </div>

        {/* Cronômetro */}
        <div
          className="flex shrink-0 items-end gap-1.5 sm:gap-2"
          role="timer"
          aria-live="polite"
          aria-label={`Tempo restante: ${hours} horas, ${minutes} minutos e ${seconds} segundos`}
        >
          <DigitBlock value={hours} label="hrs" />
          <span className="mb-6 font-mono text-xl font-bold text-white/40 sm:text-2xl">
            :
          </span>
          <DigitBlock value={minutes} label="min" />
          <span className="mb-6 font-mono text-xl font-bold text-white/40 sm:text-2xl">
            :
          </span>
          <DigitBlock value={seconds} label="seg" />
        </div>
      </div>
    </div>
  );
}
