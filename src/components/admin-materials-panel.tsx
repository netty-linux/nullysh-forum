"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useMaterialStore } from "@/lib/material-store";
import type { MaterialType } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";
import {
  Books,
  CrownSimple,
  Link as LinkIcon,
  Plus,
  Trash,
} from "@phosphor-icons/react";
import { useState } from "react";

type Props = {
  adminId: string;
  adminName: string;
  onToast: (msg: string) => void;
};

const TYPES: { value: MaterialType; label: string }[] = [
  { value: "pdf", label: "PDF" },
  { value: "template", label: "Template" },
  { value: "checklist", label: "Checklist" },
  { value: "link", label: "Link" },
  { value: "course", label: "Curso" },
];

const CATEGORIES = [
  "Geral",
  "Introdução",
  "Negócios",
  "IA",
  "Design",
  "Metodologia",
  "Ferramentas",
  "Marketing",
];

/**
 * CRUD de materiais oficiais — Painel ADM.
 * Lista vazia por padrão; só o que o admin cria aparece em /app/materials.
 */
export function AdminMaterialsPanel({
  adminId,
  adminName,
  onToast,
}: Props) {
  const materials = useMaterialStore((s) => s.materials);
  const createMaterial = useMaterialStore((s) => s.createMaterial);
  const deleteMaterial = useMaterialStore((s) => s.deleteMaterial);

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<MaterialType>("pdf");
  const [category, setCategory] = useState("Geral");
  const [size, setSize] = useState("");
  const [url, setUrl] = useState("");
  const [vipOnly, setVipOnly] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function resetForm() {
    setTitle("");
    setDescription("");
    setType("pdf");
    setCategory("Geral");
    setSize("");
    setUrl("");
    setVipOnly(false);
    setError("");
    setSaving(false);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = createMaterial({
        title,
        description,
        type,
        category,
        size: size || undefined,
        url: url || undefined,
        vipOnly,
        createdById: adminId,
        createdByName: adminName,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onToast(`Material “${res.material.title}” publicado.`);
      resetForm();
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  }

  function onDelete(id: string, matTitle: string) {
    if (!window.confirm(`Remover o material “${matTitle}”?`)) return;
    const res = deleteMaterial(id);
    if (!res.ok) {
      onToast(res.error);
      return;
    }
    onToast(`Material “${matTitle}” removido.`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#1f1f1f]">
            Materiais oficiais
          </p>
          <p className="mt-0.5 text-[13px] text-neutral-500">
            Publicados em Materiais para free e VIP (conforme o cadeado).
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
          {showForm ? "Fechar" : "Novo material"}
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
            placeholder="Ex.: Checklist de validação de oferta"
            maxLength={120}
            required
          />
          <Textarea
            label="Descrição"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="O que o membro encontra neste material?"
            className="min-h-[88px]"
            maxLength={400}
            required
          />

          <div className="grid gap-3 sm:grid-cols-2">
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
            <div>
              <p className="mb-1.5 text-[13px] font-medium text-[var(--text-primary)]">
                Categoria
              </p>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm text-[#1f1f1f] outline-none focus:border-[#1f1f1f]"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Tamanho (opcional)"
              value={size}
              onChange={(e) => setSize(e.target.value)}
              placeholder="Ex.: 1.2 MB"
              maxLength={24}
            />
            <Input
              label="URL de download / link (opcional)"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              type="url"
              autoComplete="off"
            />
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
                  ? "Free vê o card, mas precisa assinar para baixar"
                  : "Qualquer membro pode baixar"}
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
              Publicar material
            </Button>
          </div>
        </form>
      )}

      {materials.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-12 text-center">
          <Books
            size={28}
            weight="duotone"
            className="mx-auto text-neutral-300"
          />
          <p className="mt-3 text-sm font-medium text-neutral-600">
            Nenhum material ainda
          </p>
          <p className="mt-1 text-[13px] text-neutral-400">
            Crie o primeiro material oficial para a página de Materiais.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {materials.map((m) => (
            <li
              key={m.id}
              className="flex flex-col gap-3 rounded-2xl border border-neutral-200/90 bg-white p-4 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-[#1f1f1f]">
                    {m.title}
                  </p>
                  <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-[10px] font-bold uppercase text-neutral-600">
                    {TYPES.find((t) => t.value === m.type)?.label || m.type}
                  </span>
                  {m.vipOnly && (
                    <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-700">
                      <CrownSimple size={10} weight="fill" />
                      VIP
                    </span>
                  )}
                </div>
                <p className="mt-0.5 line-clamp-2 text-[13px] text-neutral-500">
                  {m.description}
                </p>
                <p className="mt-1 text-[11px] tabular-nums text-neutral-400">
                  {m.category}
                  {m.size ? ` · ${m.size}` : ""} ·{" "}
                  {m.downloads.toLocaleString("pt-BR")} downloads ·{" "}
                  {formatDate(m.createdAt)}
                  {m.url ? (
                    <>
                      {" · "}
                      <span className="inline-flex items-center gap-0.5">
                        <LinkIcon size={11} />
                        link
                      </span>
                    </>
                  ) : null}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onDelete(m.id, m.title)}
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
