"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  INTEREST_OPTIONS,
  type ForumEventType,
} from "@/lib/catalog";
import { useEventStore } from "@/lib/event-store";
import { cn, formatDate } from "@/lib/utils";
import {
  CalendarBlank,
  CrownSimple,
  Plus,
  Trash,
} from "@phosphor-icons/react";
import { useMemo, useState } from "react";

type Props = {
  adminId: string;
  adminName: string;
  onToast: (msg: string) => void;
};

const TYPES: { value: ForumEventType; label: string }[] = [
  { value: "live", label: "Live" },
  { value: "workshop", label: "Workshop" },
  { value: "networking", label: "Networking" },
  { value: "ama", label: "AMA" },
];

/** Converte Date local → valor para input datetime-local */
function toLocalInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultStartsAt() {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  d.setHours(20, 0, 0, 0);
  return toLocalInputValue(d);
}

/**
 * CRUD de eventos oficiais — Painel ADM (staff/admin).
 * Lista vazia por padrão; só o que o admin cria aparece em /app/events.
 */
export function AdminEventsPanel({
  adminId,
  adminName,
  onToast,
}: Props) {
  const events = useEventStore((s) => s.events);
  const createEvent = useEventStore((s) => s.createEvent);
  const deleteEvent = useEventStore((s) => s.deleteEvent);

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<ForumEventType>("live");
  const [startsAt, setStartsAt] = useState(defaultStartsAt);
  const [durationMin, setDurationMin] = useState("60");
  const [hostName, setHostName] = useState("Nullysh");
  const [capacity, setCapacity] = useState("100");
  const [vipOnly, setVipOnly] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const sorted = useMemo(
    () =>
      [...events].sort(
        (a, b) =>
          new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
      ),
    [events]
  );

  function resetForm() {
    setTitle("");
    setDescription("");
    setType("live");
    setStartsAt(defaultStartsAt());
    setDurationMin("60");
    setHostName(adminName || "Nullysh");
    setCapacity("100");
    setVipOnly(false);
    setTags([]);
    setError("");
    setSaving(false);
  }

  function toggleTag(tag: string) {
    setTags((prev) =>
      prev.includes(tag)
        ? prev.filter((t) => t !== tag)
        : [...prev, tag].slice(0, 8)
    );
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      // datetime-local → ISO
      const local = new Date(startsAt);
      if (Number.isNaN(local.getTime())) {
        setError("Data/hora inválida.");
        return;
      }
      const res = createEvent({
        title,
        description,
        type,
        startsAt: local.toISOString(),
        durationMin: Number(durationMin) || 60,
        hostName: hostName || adminName,
        interestTags: tags,
        vipOnly,
        capacity: Number(capacity) || 100,
        createdById: adminId,
        createdByName: adminName,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onToast(`Evento “${res.event.title}” publicado.`);
      resetForm();
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  }

  function onDelete(id: string, evTitle: string) {
    if (!window.confirm(`Remover o evento “${evTitle}”?`)) return;
    const res = deleteEvent(id);
    if (!res.ok) {
      onToast(res.error);
      return;
    }
    onToast(`Evento “${evTitle}” removido.`);
  }

  function formatWhen(iso: string) {
    return new Intl.DateTimeFormat("pt-BR", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#1f1f1f]">
            Eventos oficiais
          </p>
          <p className="mt-0.5 text-[13px] text-neutral-500">
            Lives, workshops e AMAs — membros confirmam presença (RSVP).
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => {
            resetForm();
            setShowForm((v) => !v);
          }}
        >
          <Plus size={16} weight="bold" />
          {showForm ? "Fechar" : "Novo evento"}
        </Button>
      </div>

      {showForm && (
        <form
          onSubmit={onSubmit}
          className="space-y-3 rounded-2xl border border-neutral-200/90 bg-white p-4 shadow-[0_1px_2px_rgb(0_0_0/0.04)] sm:p-5"
        >
          <Input
            label="Título"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex.: Live: funis enxutos com o plano VIP"
            maxLength={140}
            required
          />
          <Textarea
            label="Descrição"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="O que vai rolar? Quem deve participar?"
            className="min-h-[88px]"
            maxLength={500}
            required
          />

          <div>
            <p className="mb-1.5 text-[13px] font-medium text-[var(--text-primary)]">
              Tipo
            </p>
            <div className="flex flex-wrap gap-1.5">
              {TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-[12px] font-medium transition",
                    type === t.value
                      ? "bg-[#1f1f1f] text-white"
                      : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Data e hora"
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              required
            />
            <Input
              label="Duração (minutos)"
              type="number"
              min={15}
              max={1440}
              step={15}
              value={durationMin}
              onChange={(e) => setDurationMin(e.target.value)}
              required
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Host / anfitrião"
              value={hostName}
              onChange={(e) => setHostName(e.target.value)}
              placeholder="Nullysh"
              maxLength={48}
            />
            <Input
              label="Capacidade (vagas)"
              type="number"
              min={1}
              max={100000}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              required
            />
          </div>

          <div>
            <p className="mb-1.5 text-[13px] font-medium text-[var(--text-primary)]">
              Tags de interesse (opcional)
            </p>
            <div className="flex flex-wrap gap-1.5">
              {INTEREST_OPTIONS.map((tag) => {
                const active = tags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[11px] font-medium transition",
                      active
                        ? "bg-[#1f1f1f] text-white"
                        : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                    )}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setVipOnly((v) => !v)}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-2xl border-2 px-3.5 py-3 text-left transition",
              vipOnly
                ? "border-[#1f1f1f] bg-neutral-50"
                : "border-neutral-200 hover:border-neutral-300"
            )}
          >
            <CrownSimple
              size={18}
              weight="fill"
              className={vipOnly ? "text-amber-600" : "text-neutral-400"}
            />
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold text-[#1f1f1f]">
                {vipOnly ? "Só VIP" : "Todos (free + VIP)"}
              </span>
              <span className="mt-0.5 block text-[12px] text-neutral-500">
                {vipOnly
                  ? "Free vê o card, mas precisa assinar para confirmar presença"
                  : "Qualquer membro pode fazer RSVP"}
              </span>
            </span>
          </button>

          {error && (
            <p className="text-[13px] font-medium text-red-600" role="alert">
              {error}
            </p>
          )}

          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetForm();
                setShowForm(false);
              }}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button type="submit" loading={saving}>
              Publicar evento
            </Button>
          </div>
        </form>
      )}

      {sorted.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-12 text-center">
          <CalendarBlank
            size={28}
            weight="duotone"
            className="mx-auto text-neutral-300"
          />
          <p className="mt-3 text-sm font-medium text-neutral-600">
            Nenhum evento ainda
          </p>
          <p className="mt-1 text-[13px] text-neutral-400">
            Crie o primeiro evento para a agenda da comunidade.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {sorted.map((ev) => (
            <li
              key={ev.id}
              className="flex flex-col gap-3 rounded-2xl border border-neutral-200/90 bg-white p-4 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-[#1f1f1f]">
                    {ev.title}
                  </p>
                  <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-[10px] font-bold uppercase text-neutral-600">
                    {TYPES.find((t) => t.value === ev.type)?.label || ev.type}
                  </span>
                  {ev.vipOnly && (
                    <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-700">
                      <CrownSimple size={10} weight="fill" />
                      VIP
                    </span>
                  )}
                </div>
                <p className="mt-0.5 line-clamp-2 text-[13px] text-neutral-500">
                  {ev.description}
                </p>
                <p className="mt-1 text-[11px] tabular-nums text-neutral-400">
                  {formatWhen(ev.startsAt)} · {ev.durationMin} min ·{" "}
                  {ev.capacity} vagas · host {ev.hostName}
                  {ev.createdAt ? ` · criado ${formatDate(ev.createdAt)}` : ""}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onDelete(ev.id, ev.title)}
                className="shrink-0 text-red-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700"
              >
                <Trash size={14} weight="bold" />
                Remover
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
