"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { INTEREST_OPTIONS, type TrailLevel, type TrailStepType } from "@/lib/catalog";
import { useTrailStore } from "@/lib/trail-store";
import { cn } from "@/lib/utils";
import {
  CrownSimple,
  Path,
  Plus,
  Trash,
  UsersThree,
} from "@phosphor-icons/react";
import { useState } from "react";

type StepDraft = {
  key: string;
  title: string;
  description: string;
  type: TrailStepType;
  duration: string;
};

type Props = {
  adminId: string;
  adminName: string;
  onToast: (msg: string) => void;
};

const LEVELS: TrailLevel[] = ["iniciante", "intermediário", "avançado"];
const STEP_TYPES: { value: TrailStepType; label: string }[] = [
  { value: "video", label: "Vídeo" },
  { value: "material", label: "Material" },
  { value: "practice", label: "Prática" },
  { value: "live", label: "Live" },
];

function emptyStep(): StepDraft {
  return {
    key: Math.random().toString(36).slice(2, 9),
    title: "",
    description: "",
    type: "practice",
    duration: "",
  };
}

/**
 * CRUD de trilhas de aprendizado — Painel ADM (admin/staff).
 */
export function AdminTrailsPanel({ adminId, adminName, onToast }: Props) {
  const trails = useTrailStore((s) => s.trails);
  const createTrail = useTrailStore((s) => s.createTrail);
  const deleteTrail = useTrailStore((s) => s.deleteTrail);

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [level, setLevel] = useState<TrailLevel>("iniciante");
  const [vipOnly, setVipOnly] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [steps, setSteps] = useState<StepDraft[]>([emptyStep()]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function resetForm() {
    setTitle("");
    setDescription("");
    setLevel("iniciante");
    setVipOnly(false);
    setTags([]);
    setSteps([emptyStep()]);
    setError("");
    setSaving(false);
  }

  function toggleTag(tag: string) {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag].slice(0, 8)
    );
  }

  function updateStep(key: string, patch: Partial<StepDraft>) {
    setSteps((prev) =>
      prev.map((s) => (s.key === key ? { ...s, ...patch } : s))
    );
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = createTrail({
        title,
        description,
        level,
        vipOnly,
        interestTags: tags,
        steps: steps.map((s) => ({
          title: s.title,
          description: s.description,
          type: s.type,
          duration: s.duration || undefined,
        })),
        createdById: adminId,
        createdByName: adminName,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onToast(`Trilha “${res.trail.title}” publicada.`);
      resetForm();
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  }

  function onDelete(id: string, name: string) {
    const ok = window.confirm(
      `Excluir a trilha “${name}”? O progresso dos membros nela será órfão.`
    );
    if (!ok) return;
    const res = deleteTrail(id);
    if (!res.ok) {
      onToast(res.error);
      return;
    }
    onToast(`Trilha “${name}” removida.`);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#1f1f1f]">
            Trilhas de aprendizado
          </p>
          <p className="mt-0.5 text-[13px] text-neutral-500">
            Publique caminhos para free e VIP. Aparecem em Trilhas.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          className="rounded-full"
          onClick={() => {
            if (showForm) {
              resetForm();
              setShowForm(false);
            } else {
              setShowForm(true);
            }
          }}
        >
          {showForm ? (
            "Cancelar"
          ) : (
            <>
              <Plus size={15} weight="bold" />
              Nova trilha
            </>
          )}
        </Button>
      </div>

      {showForm && (
        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-2xl border-2 border-[#1f1f1f]/10 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-[#141414]"
        >
          <Input
            label="Título"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex.: Fundamentos de IA"
            required
            maxLength={80}
          />
          <Textarea
            label="Descrição"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="O que o membro vai aprender nesta trilha?"
            className="min-h-[88px]"
            required
            maxLength={400}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-[13px] font-medium text-[var(--text-primary)]">
                Nível
              </p>
              <div className="flex flex-wrap gap-1.5">
                {LEVELS.map((lv) => (
                  <button
                    key={lv}
                    type="button"
                    onClick={() => setLevel(lv)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-[12px] font-semibold capitalize transition",
                      level === lv
                        ? "border-[#1f1f1f] bg-[#1f1f1f] text-white"
                        : "border-neutral-200 text-neutral-600 hover:border-neutral-400"
                    )}
                  >
                    {lv}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-[13px] font-medium text-[var(--text-primary)]">
                Público
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setVipOnly(false)}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-left transition",
                    !vipOnly
                      ? "border-[#1f1f1f] bg-neutral-50"
                      : "border-neutral-200 hover:border-neutral-300"
                  )}
                >
                  <UsersThree size={16} weight="bold" />
                  <span>
                    <span className="block text-[12px] font-semibold">Free + VIP</span>
                    <span className="block text-[11px] text-neutral-500">
                      Todos acessam
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setVipOnly(true)}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-left transition",
                    vipOnly
                      ? "border-[#1f1f1f] bg-neutral-50"
                      : "border-neutral-200 hover:border-neutral-300"
                  )}
                >
                  <CrownSimple size={16} weight="fill" className="text-amber-500" />
                  <span>
                    <span className="block text-[12px] font-semibold">Só VIP</span>
                    <span className="block text-[11px] text-neutral-500">
                      Exclusivo do plano
                    </span>
                  </span>
                </button>
              </div>
            </div>
          </div>

          <div>
            <p className="mb-2 text-[13px] font-medium text-[var(--text-primary)]">
              Tags de interesse
            </p>
            <div className="flex flex-wrap gap-1.5">
              {INTEREST_OPTIONS.map((tag) => {
                const on = tags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition",
                      on
                        ? "border-[#1f1f1f] bg-[#1f1f1f] text-white"
                        : "border-neutral-200 text-neutral-600 hover:border-neutral-400"
                    )}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[13px] font-medium text-[var(--text-primary)]">
                Etapas
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setSteps((s) => [...s, emptyStep()])}
              >
                <Plus size={14} weight="bold" />
                Etapa
              </Button>
            </div>
            <div className="space-y-3">
              {steps.map((step, idx) => (
                <div
                  key={step.key}
                  className="rounded-xl border border-neutral-200 bg-neutral-50/80 p-3 dark:border-zinc-700 dark:bg-zinc-900/50"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                      Etapa {idx + 1}
                    </span>
                    {steps.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setSteps((s) => s.filter((x) => x.key !== step.key))
                        }
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 hover:bg-white hover:text-red-600"
                        aria-label="Remover etapa"
                      >
                        <Trash size={14} weight="bold" />
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Input
                      placeholder="Título da etapa"
                      value={step.title}
                      onChange={(e) =>
                        updateStep(step.key, { title: e.target.value })
                      }
                      required
                    />
                    <Input
                      placeholder="Descrição curta"
                      value={step.description}
                      onChange={(e) =>
                        updateStep(step.key, { description: e.target.value })
                      }
                    />
                    <div className="flex flex-wrap gap-2">
                      <select
                        value={step.type}
                        onChange={(e) =>
                          updateStep(step.key, {
                            type: e.target.value as TrailStepType,
                          })
                        }
                        className="h-10 rounded-lg border border-neutral-200 bg-white px-3 text-[13px] text-[#1f1f1f] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                      >
                        {STEP_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                      <Input
                        placeholder="Duração (ex.: 15 min)"
                        value={step.duration}
                        onChange={(e) =>
                          updateStep(step.key, { duration: e.target.value })
                        }
                        className="max-w-[10rem]"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-[13px] font-medium text-red-600" role="alert">
              {error}
            </p>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="submit" loading={saving} className="rounded-full">
              Publicar trilha
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => {
                resetForm();
                setShowForm(false);
              }}
              disabled={saving}
            >
              Cancelar
            </Button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {trails.length === 0 && !showForm ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-12 text-center">
            <Path
              size={28}
              weight="duotone"
              className="mx-auto text-neutral-400"
            />
            <p className="mt-3 text-sm font-semibold text-[#1f1f1f]">
              Nenhuma trilha publicada
            </p>
            <p className="mt-1 text-[13px] text-neutral-500">
              Crie a primeira trilha para free e/ou VIP.
            </p>
            <Button
              type="button"
              className="mt-4 rounded-full"
              onClick={() => setShowForm(true)}
            >
              <Plus size={15} weight="bold" />
              Nova trilha
            </Button>
          </div>
        ) : (
          trails.map((t) => (
            <article
              key={t.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-neutral-200/90 bg-white p-4 shadow-[0_1px_2px_rgb(0_0_0/0.04)] sm:p-5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[15px] font-semibold text-[#1f1f1f]">
                    {t.title}
                  </h3>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                      t.vipOnly
                        ? "bg-[#1f1f1f] text-white"
                        : "bg-neutral-100 text-neutral-600"
                    )}
                  >
                    {t.vipOnly ? "VIP" : "Free"}
                  </span>
                  <span className="rounded-full border border-neutral-200 px-2 py-0.5 text-[10px] font-semibold capitalize text-neutral-500">
                    {t.level}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 max-w-full break-words text-[13px] text-neutral-500 [overflow-wrap:anywhere]">
                  {t.description}
                </p>
                <p className="mt-2 text-[12px] tabular-nums text-neutral-400">
                  {t.steps.length} etapa{t.steps.length === 1 ? "" : "s"}
                  {t.createdByName ? ` · ${t.createdByName}` : ""}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="shrink-0 text-red-600 hover:border-red-300 hover:bg-red-50"
                onClick={() => onDelete(t.id, t.title)}
              >
                <Trash size={14} weight="bold" />
                Excluir
              </Button>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
