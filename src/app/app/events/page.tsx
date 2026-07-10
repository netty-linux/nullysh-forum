"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TagList } from "@/components/tag-chips";
import { useAuth } from "@/hooks/use-auth";
import { FORUM_EVENTS } from "@/lib/catalog";
import { useProgressStore } from "@/lib/progress-store";
import { formatDate } from "@/lib/utils";
import {
  CalendarBlank,
  Lock,
  MapPin,
  UsersThree,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useMemo, useState } from "react";

const typeLabel = {
  live: "Live",
  workshop: "Workshop",
  networking: "Networking",
  ama: "AMA",
} as const;

function formatWhen(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default function EventsPage() {
  const { user, isVip } = useAuth();
  const rsvps = useProgressStore((s) => s.rsvps);
  const toggleRsvp = useProgressStore((s) => s.toggleRsvp);
  const [filter, setFilter] = useState<"all" | "mine" | "open">("all");
  const [toast, setToast] = useState("");

  const list = useMemo(() => {
    let events = [...FORUM_EVENTS].sort(
      (a, b) =>
        new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
    );
    if (filter === "mine" && user) {
      const mine = new Set(
        rsvps.filter((r) => r.userId === user.id).map((r) => r.eventId)
      );
      events = events.filter((e) => mine.has(e.id));
    }
    if (filter === "open") {
      events = events.filter((e) => !e.vipOnly || isVip);
    }
    return events;
  }, [filter, rsvps, user, isVip]);

  function onRsvp(eventId: string, locked: boolean) {
    if (!user) return;
    if (locked) return;
    toggleRsvp(eventId, user.id);
    const going = useProgressStore
      .getState()
      .hasRsvp(eventId, user.id);
    setToast(going ? "Presença confirmada." : "RSVP removido.");
    setTimeout(() => setToast(""), 2000);
  }

  return (
    <div className="app-page mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <CalendarBlank size={22} weight="bold" className="text-[#1f1f1f]" />
          <h1 className="text-2xl font-semibold tracking-tight text-[#1f1f1f] sm:text-3xl">
            Eventos
          </h1>
        </div>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-neutral-500">
          Lives, workshops, networking e AMAs da comunidade Nullysh.
        </p>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {(
          [
            ["all", "Todos"],
            ["open", "Disponíveis"],
            ["mine", "Meus RSVPs"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={
              filter === key
                ? "chip rounded-full bg-[#1f1f1f] px-4 py-2 text-sm font-semibold text-white"
                : "chip rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-600"
            }
          >
            {label}
          </button>
        ))}
      </div>

      {toast && (
        <div className="mb-4 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-[#1f1f1f] shadow-sm">
          {toast}
        </div>
      )}

      <div className="space-y-3">
        {list.map((ev) => {
          const locked = ev.vipOnly && !isVip;
          const count = rsvps.filter((r) => r.eventId === ev.id).length;
          const going =
            !!user &&
            rsvps.some((r) => r.eventId === ev.id && r.userId === user.id);

          return (
            <article
              key={ev.id}
              className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04)] sm:p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{typeLabel[ev.type]}</Badge>
                    {ev.vipOnly && (
                      <Badge variant="vip">
                        {locked && (
                          <Lock size={10} weight="bold" className="mr-0.5" />
                        )}
                        VIP
                      </Badge>
                    )}
                  </div>
                  <h2 className="mt-2 text-base font-semibold tracking-tight text-[#1f1f1f] sm:text-lg">
                    {ev.title}
                  </h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">
                    {ev.description}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-neutral-500">
                    <span className="inline-flex items-center gap-1">
                      <CalendarBlank size={14} weight="bold" />
                      {formatWhen(ev.startsAt)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={14} weight="bold" />
                      Online · {ev.durationMin} min
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <UsersThree size={14} weight="bold" />
                      {count}/{ev.capacity} · host {ev.hostName}
                    </span>
                  </div>
                  <div className="mt-3">
                    <TagList tags={ev.interestTags} />
                  </div>
                </div>
                <div className="shrink-0">
                  {locked ? (
                    <Link href="/pricing">
                      <Button variant="outline" size="sm">
                        <Lock size={14} weight="bold" />
                        VIP
                      </Button>
                    </Link>
                  ) : (
                    <Button
                      size="sm"
                      variant={going ? "outline" : "primary"}
                      onClick={() => onRsvp(ev.id, locked)}
                    >
                      {going ? "Cancelar RSVP" : "Confirmar presença"}
                    </Button>
                  )}
                </div>
              </div>
            </article>
          );
        })}

        {list.length === 0 && (
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-12 text-center text-sm text-neutral-500">
            Nenhum evento neste filtro.
          </div>
        )}
      </div>

      <p className="mt-6 text-center text-xs text-neutral-400">
        Datas de exemplo no MVP · {formatDate(FORUM_EVENTS[0].startsAt)} em
        diante
      </p>
    </div>
  );
}
