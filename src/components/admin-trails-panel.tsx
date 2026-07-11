"use client";

import { TrailRichEditor } from "@/components/trail-rich-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  INTEREST_OPTIONS,
  type LearningTrail,
  type TrailAttachment,
  type TrailLevel,
  type TrailLink,
  type TrailStepType,
} from "@/lib/catalog";
import {
  formatFileSize,
  MAX_TRAIL_ATTACHMENT_BYTES,
  MAX_TRAIL_ATTACHMENTS,
  removeTrailAttachment,
  storeTrailFile,
} from "@/lib/trail-attachments";
import { useTrailStore } from "@/lib/trail-store";
import { cn, uid } from "@/lib/utils";
import { fetchVideos } from "@/lib/videos/client";
import type { VideoPublic } from "@/lib/videos/types";
import {
  CrownSimple,
  FilmStrip,
  Link as LinkIcon,
  Paperclip,
  Path,
  PencilSimple,
  Plus,
  Trash,
  UsersThree,
  X,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";

type StepDraft = {
  key: string;
  /** id real da etapa (ao editar) */
  stepId?: string;
  title: string;
  description: string;
  type: TrailStepType;
  duration: string;
  videoId: string;
  videoTitle: string;
  links: TrailLink[];
  attachments: TrailAttachment[];
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
    videoId: "",
    videoTitle: "",
    links: [],
    attachments: [],
  };
}

function emptyLink(): TrailLink {
  return { id: uid("tlink"), label: "", url: "" };
}

function trailToDraft(trail: LearningTrail): {
  title: string;
  description: string;
  level: TrailLevel;
  vipOnly: boolean;
  tags: string[];
  steps: StepDraft[];
  trailLinks: TrailLink[];
  trailAttachments: TrailAttachment[];
} {
  return {
    title: trail.title,
    description: trail.description || "",
    level: trail.level,
    vipOnly: !!trail.vipOnly,
    tags: [...(trail.interestTags || [])],
    steps:
      trail.steps.length > 0
        ? trail.steps.map((s) => ({
            key: s.id || Math.random().toString(36).slice(2, 9),
            stepId: s.id,
            title: s.title,
            description: s.description || "",
            type: s.type,
            duration: s.duration || "",
            videoId: s.videoId || "",
            videoTitle: s.videoTitle || "",
            links: [...(s.links || [])],
            attachments: [...(s.attachments || [])],
          }))
        : [emptyStep()],
    trailLinks: [...(trail.links || [])],
    trailAttachments: [...(trail.attachments || [])],
  };
}

/**
 * CRUD de trilhas — criar, editar, vídeos, anexos, links e descrição rica.
 */
export function AdminTrailsPanel({ adminId, adminName, onToast }: Props) {
  const trails = useTrailStore((s) => s.trails);
  const createTrail = useTrailStore((s) => s.createTrail);
  const updateTrail = useTrailStore((s) => s.updateTrail);
  const deleteTrail = useTrailStore((s) => s.deleteTrail);

  const [showForm, setShowForm] = useState(false);
  /** null = criando; string = editando id */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [level, setLevel] = useState<TrailLevel>("iniciante");
  const [vipOnly, setVipOnly] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [steps, setSteps] = useState<StepDraft[]>([emptyStep()]);
  const [trailLinks, setTrailLinks] = useState<TrailLink[]>([]);
  const [trailAttachments, setTrailAttachments] = useState<TrailAttachment[]>(
    []
  );
  const [videos, setVideos] = useState<VideoPublic[]>([]);
  const [videosLoading, setVideosLoading] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [attachBusy, setAttachBusy] = useState(false);

  const isEditing = !!editingId;

  useEffect(() => {
    if (!showForm) return;
    let cancelled = false;
    setVideosLoading(true);
    (async () => {
      try {
        const res = await fetchVideos();
        if (!cancelled) setVideos(res.videos || []);
      } catch {
        if (!cancelled) setVideos([]);
      } finally {
        if (!cancelled) setVideosLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showForm]);

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setDescription("");
    setLevel("iniciante");
    setVipOnly(false);
    setTags([]);
    setSteps([emptyStep()]);
    setTrailLinks([]);
    setTrailAttachments([]);
    setError("");
    setSaving(false);
  }

  function openCreate() {
    resetForm();
    setShowForm(true);
  }

  function openEdit(trail: LearningTrail) {
    const d = trailToDraft(trail);
    setEditingId(trail.id);
    setTitle(d.title);
    setDescription(d.description);
    setLevel(d.level);
    setVipOnly(d.vipOnly);
    setTags(d.tags);
    setSteps(d.steps);
    setTrailLinks(d.trailLinks);
    setTrailAttachments(d.trailAttachments);
    setError("");
    setShowForm(true);
    // scroll para o formulário
    window.requestAnimationFrame(() => {
      document
        .getElementById("admin-trail-form")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function closeForm() {
    resetForm();
    setShowForm(false);
  }

  function toggleTag(tag: string) {
    setTags((prev) =>
      prev.includes(tag)
        ? prev.filter((t) => t !== tag)
        : [...prev, tag].slice(0, 8)
    );
  }

  function updateStep(key: string, patch: Partial<StepDraft>) {
    setSteps((prev) =>
      prev.map((s) => (s.key === key ? { ...s, ...patch } : s))
    );
  }

  async function addAttachment(
    files: FileList | null,
    target: "trail" | string
  ) {
    if (!files?.length) return;
    setAttachBusy(true);
    setError("");
    try {
      const list =
        target === "trail"
          ? trailAttachments
          : steps.find((s) => s.key === target)?.attachments || [];
      if (list.length + files.length > MAX_TRAIL_ATTACHMENTS) {
        setError(`Máximo de ${MAX_TRAIL_ATTACHMENTS} anexos por seção.`);
        return;
      }
      const added: TrailAttachment[] = [];
      for (const file of Array.from(files)) {
        if (file.size > MAX_TRAIL_ATTACHMENT_BYTES) {
          setError(
            `“${file.name}” excede ${(MAX_TRAIL_ATTACHMENT_BYTES / (1024 * 1024)).toFixed(0)} MB.`
          );
          continue;
        }
        const att = await storeTrailFile(file);
        added.push(att);
      }
      if (!added.length) return;
      if (target === "trail") {
        setTrailAttachments((prev) => [...prev, ...added]);
      } else {
        setSteps((prev) =>
          prev.map((s) =>
            s.key === target
              ? { ...s, attachments: [...s.attachments, ...added] }
              : s
          )
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao anexar arquivo.");
    } finally {
      setAttachBusy(false);
    }
  }

  async function removeAttachment(
    storageKey: string,
    target: "trail" | string,
    id: string
  ) {
    await removeTrailAttachment(storageKey);
    if (target === "trail") {
      setTrailAttachments((prev) => prev.filter((a) => a.id !== id));
    } else {
      setSteps((prev) =>
        prev.map((s) =>
          s.key === target
            ? { ...s, attachments: s.attachments.filter((a) => a.id !== id) }
            : s
        )
      );
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const cleanLinks = (list: TrailLink[]) =>
        list
          .map((l) => ({
            ...l,
            label: l.label.trim(),
            url: l.url.trim(),
          }))
          .filter((l) => l.label && l.url);

      const payload = {
        title,
        description: description || "",
        level,
        vipOnly,
        interestTags: tags,
        links: cleanLinks(trailLinks),
        attachments: trailAttachments,
        steps: steps.map((s) => ({
          id: s.stepId,
          title: s.title,
          description: s.description,
          type: s.type,
          duration: s.duration || undefined,
          videoId: s.videoId || null,
          videoTitle: s.videoTitle || null,
          links: cleanLinks(s.links),
          attachments: s.attachments,
        })),
      };

      if (editingId) {
        const res = updateTrail(editingId, payload);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        onToast(`Trilha “${res.trail.title}” atualizada.`);
      } else {
        const res = createTrail({
          ...payload,
          createdById: adminId,
          createdByName: adminName,
        });
        if (!res.ok) {
          setError(res.error);
          return;
        }
        onToast(`Trilha “${res.trail.title}” publicada.`);
      }
      closeForm();
    } finally {
      setSaving(false);
    }
  }

  function onDelete(id: string, name: string) {
    const ok = window.confirm(
      `Excluir a trilha “${name}”? O progresso dos membros nela será órfão.`
    );
    if (!ok) return;
    if (editingId === id) closeForm();
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
            Crie e edite trilhas com vídeos, anexos e links.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          className="rounded-full"
          onClick={() => {
            if (showForm) closeForm();
            else openCreate();
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
          id="admin-trail-form"
          onSubmit={onSubmit}
          className="space-y-4 scroll-mt-24 rounded-2xl border-2 border-[#1f1f1f]/10 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-[#141414]"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 pb-3 dark:border-zinc-800">
            <div>
              <p className="text-[13px] font-semibold text-[#1f1f1f]">
                {isEditing ? "Editar trilha" : "Nova trilha"}
              </p>
              <p className="mt-0.5 text-[12px] text-neutral-500">
                {isEditing
                  ? "Altere o conteúdo e salve. Etapas existentes mantêm o progresso dos membros."
                  : "Preencha e publique para aparecer em Trilhas."}
              </p>
            </div>
            {isEditing && (
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                Modo edição
              </span>
            )}
          </div>

          <Input
            label="Título"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex.: Fundamentos de IA"
            required
            maxLength={80}
          />

          <TrailRichEditor
            label="Descrição"
            value={description}
            onChange={setDescription}
            placeholder="Conte a jornada da trilha — headlines, negrito, destaques…"
            minHeight={160}
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
              <p
                id="trail-audience-label"
                className="mb-2 text-[13px] font-medium text-[var(--text-primary)]"
              >
                Público
              </p>
              <div
                role="radiogroup"
                aria-labelledby="trail-audience-label"
                className="grid grid-cols-2 gap-2"
              >
                <label
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-left transition",
                    !vipOnly
                      ? "border-[#1f1f1f] bg-neutral-50 shadow-sm"
                      : "border-neutral-200 bg-white hover:border-neutral-400"
                  )}
                >
                  <input
                    type="radio"
                    name="trail-audience"
                    className="sr-only"
                    checked={!vipOnly}
                    onChange={() => setVipOnly(false)}
                  />
                  <UsersThree
                    size={16}
                    weight="bold"
                    className={!vipOnly ? "text-[#1f1f1f]" : "text-neutral-400"}
                  />
                  <span>
                    <span
                      className={cn(
                        "block text-[12px] font-semibold",
                        !vipOnly ? "text-[#1f1f1f]" : "text-neutral-600"
                      )}
                    >
                      Free + VIP
                    </span>
                    <span className="block text-[11px] text-neutral-500">
                      Todos acessam
                    </span>
                  </span>
                </label>
                <label
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-left transition",
                    vipOnly
                      ? "border-[#1f1f1f] bg-neutral-50 shadow-sm"
                      : "border-neutral-200 bg-white hover:border-neutral-400"
                  )}
                >
                  <input
                    type="radio"
                    name="trail-audience"
                    className="sr-only"
                    checked={vipOnly}
                    onChange={() => setVipOnly(true)}
                  />
                  <CrownSimple
                    size={16}
                    weight="fill"
                    className={vipOnly ? "text-amber-500" : "text-neutral-400"}
                  />
                  <span>
                    <span
                      className={cn(
                        "block text-[12px] font-semibold",
                        vipOnly ? "text-[#1f1f1f]" : "text-neutral-600"
                      )}
                    >
                      Só VIP
                    </span>
                    <span className="block text-[11px] text-neutral-500">
                      Exclusivo do plano
                    </span>
                  </span>
                </label>
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

          {/* Links da trilha */}
          <ResourceLinksEditor
            title="Links da trilha"
            links={trailLinks}
            onChange={setTrailLinks}
          />

          {/* Anexos da trilha */}
          <ResourceAttachmentsEditor
            title="Anexos da trilha"
            attachments={trailAttachments}
            busy={attachBusy}
            onAdd={(files) => void addAttachment(files, "trail")}
            onRemove={(a) => void removeAttachment(a.storageKey, "trail", a.id)}
          />

          {/* Etapas */}
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
                        onChange={(e) => {
                          const type = e.target.value as TrailStepType;
                          updateStep(step.key, {
                            type,
                            ...(type !== "video"
                              ? { videoId: "", videoTitle: "" }
                              : {}),
                          });
                        }}
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

                    {/* Vincular vídeo */}
                    <div className="rounded-lg border border-dashed border-neutral-200 bg-white p-2.5 dark:border-zinc-700 dark:bg-zinc-900">
                      <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                        <FilmStrip size={12} weight="bold" />
                        Vídeo da plataforma
                      </p>
                      {videosLoading ? (
                        <p className="text-[12px] text-neutral-400">
                          Carregando vídeos…
                        </p>
                      ) : videos.length === 0 ? (
                        <p className="text-[12px] text-neutral-400">
                          Nenhum vídeo no catálogo. Publique em ADM → Vídeos.
                        </p>
                      ) : (
                        <select
                          value={step.videoId}
                          onChange={(e) => {
                            const id = e.target.value;
                            const v = videos.find((x) => x.id === id);
                            updateStep(step.key, {
                              videoId: id,
                              videoTitle: v?.title || "",
                              type: id ? "video" : step.type,
                            });
                          }}
                          className="h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-[13px] outline-none dark:border-zinc-700 dark:bg-zinc-900"
                        >
                          <option value="">Sem vídeo vinculado</option>
                          {videos.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.title}
                              {v.vipOnly ? " · VIP" : ""}
                            </option>
                          ))}
                        </select>
                      )}
                      {step.videoId ? (
                        <p className="mt-1.5 text-[11px] text-sky-600">
                          Abre em /app/videos?id={step.videoId}
                        </p>
                      ) : null}
                    </div>

                    <ResourceLinksEditor
                      title="Links da etapa"
                      links={step.links}
                      onChange={(links) => updateStep(step.key, { links })}
                      compact
                    />

                    <ResourceAttachmentsEditor
                      title="Anexos da etapa"
                      attachments={step.attachments}
                      busy={attachBusy}
                      compact
                      onAdd={(files) => void addAttachment(files, step.key)}
                      onRemove={(a) =>
                        void removeAttachment(a.storageKey, step.key, a.id)
                      }
                    />
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
              {isEditing ? "Salvar alterações" : "Publicar trilha"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={closeForm}
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
              Crie a primeira trilha com vídeos, anexos e links.
            </p>
            <Button
              type="button"
              className="mt-4 rounded-full"
              onClick={openCreate}
            >
              <Plus size={15} weight="bold" />
              Nova trilha
            </Button>
          </div>
        ) : (
          trails.map((t) => {
            const active = editingId === t.id;
            return (
              <article
                key={t.id}
                className={cn(
                  "flex flex-wrap items-start justify-between gap-3 rounded-2xl border bg-white p-4 shadow-[0_1px_2px_rgb(0_0_0/0.04)] sm:p-5",
                  active
                    ? "border-[#1f1f1f] ring-2 ring-[#1f1f1f]/10"
                    : "border-neutral-200/90"
                )}
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
                    {active && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                        Editando
                      </span>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 max-w-full break-words text-[13px] text-neutral-500 [overflow-wrap:anywhere]">
                    {t.description.replace(/<[^>]+>/g, " ").trim()}
                  </p>
                  <p className="mt-2 text-[12px] tabular-nums text-neutral-400">
                    {t.steps.length} etapa{t.steps.length === 1 ? "" : "s"}
                    {(t.links?.length || 0) > 0
                      ? ` · ${t.links!.length} link(s)`
                      : ""}
                    {(t.attachments?.length || 0) > 0
                      ? ` · ${t.attachments!.length} anexo(s)`
                      : ""}
                    {t.createdByName ? ` · ${t.createdByName}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => openEdit(t)}
                  >
                    <PencilSimple size={14} weight="bold" />
                    Editar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="text-red-600 hover:border-red-300 hover:bg-red-50"
                    onClick={() => onDelete(t.id, t.title)}
                  >
                    <Trash size={14} weight="bold" />
                    Excluir
                  </Button>
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}

function ResourceLinksEditor({
  title,
  links,
  onChange,
  compact,
}: {
  title: string;
  links: TrailLink[];
  onChange: (links: TrailLink[]) => void;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-neutral-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900",
        compact && "p-2.5"
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
          <LinkIcon size={12} weight="bold" />
          {title}
        </p>
        <button
          type="button"
          onClick={() => onChange([...links, emptyLink()])}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-sky-600 hover:bg-sky-50"
        >
          <Plus size={12} weight="bold" />
          Link
        </button>
      </div>
      {links.length === 0 ? (
        <p className="text-[12px] text-neutral-400">
          Nenhum link. Adicione URLs personalizadas.
        </p>
      ) : (
        <div className="space-y-2">
          {links.map((l, i) => (
            <div key={l.id} className="flex flex-wrap items-start gap-2">
              <Input
                placeholder="Rótulo (ex.: Planilha)"
                value={l.label}
                onChange={(e) => {
                  const next = [...links];
                  next[i] = { ...l, label: e.target.value };
                  onChange(next);
                }}
                className="min-w-[8rem] flex-1"
              />
              <Input
                placeholder="https://…"
                value={l.url}
                onChange={(e) => {
                  const next = [...links];
                  next[i] = { ...l, url: e.target.value };
                  onChange(next);
                }}
                className="min-w-[10rem] flex-[2]"
              />
              <button
                type="button"
                onClick={() => onChange(links.filter((x) => x.id !== l.id))}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-red-600"
                aria-label="Remover link"
              >
                <X size={14} weight="bold" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ResourceAttachmentsEditor({
  title,
  attachments,
  onAdd,
  onRemove,
  busy,
  compact,
}: {
  title: string;
  attachments: TrailAttachment[];
  onAdd: (files: FileList | null) => void;
  onRemove: (a: TrailAttachment) => void;
  busy?: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-neutral-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900",
        compact && "p-2.5"
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
          <Paperclip size={12} weight="bold" />
          {title}
        </p>
        <label
          className={cn(
            "inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-sky-600 hover:bg-sky-50",
            busy && "pointer-events-none opacity-50"
          )}
        >
          <Plus size={12} weight="bold" />
          Arquivo
          <input
            type="file"
            className="hidden"
            multiple
            onChange={(e) => {
              onAdd(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      {attachments.length === 0 ? (
        <p className="text-[12px] text-neutral-400">
          Nenhum anexo · máx.{" "}
          {(MAX_TRAIL_ATTACHMENT_BYTES / (1024 * 1024)).toFixed(0)} MB cada
        </p>
      ) : (
        <ul className="space-y-1.5">
          {attachments.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between gap-2 rounded-lg bg-neutral-50 px-2.5 py-2 text-[12px] dark:bg-zinc-800"
            >
              <span className="min-w-0 truncate font-medium text-[#1f1f1f] dark:text-zinc-100">
                {a.name}
                <span className="ml-1.5 font-normal text-neutral-400">
                  {formatFileSize(a.size)}
                </span>
              </span>
              <button
                type="button"
                onClick={() => onRemove(a)}
                className="shrink-0 text-neutral-400 hover:text-red-600"
                aria-label={`Remover ${a.name}`}
              >
                <Trash size={14} weight="bold" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
