"use client";

import { sanitizeTrailHtml, TRAIL_RICH_BODY_CLASS } from "@/lib/trail-html";
import { cn } from "@/lib/utils";
import {
  Link as LinkIcon,
  ListBullets,
  ListNumbers,
  TextB,
  TextH,
  TextItalic,
  TextUnderline,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useRef } from "react";

type Props = {
  label?: string;
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: number;
};

const FONTS = [
  { label: "Padrão", value: "" },
  { label: "Serif", value: "Georgia, 'Times New Roman', serif" },
  { label: "Mono", value: "ui-monospace, SFMono-Regular, Menlo, monospace" },
  { label: "Display", value: "Satoshi, system-ui, sans-serif" },
];

const HIGHLIGHTS = [
  { label: "Nenhum", value: "" },
  { label: "Amarelo", value: "#fef08a" },
  { label: "Verde", value: "#bbf7d0" },
  { label: "Azul", value: "#bfdbfe" },
  { label: "Rosa", value: "#fbcfe8" },
  { label: "Laranja", value: "#fed7aa" },
];

const TEXT_COLORS = [
  { label: "Padrão", value: "" },
  { label: "Preto", value: "#1f1f1f" },
  { label: "Cinza", value: "#737373" },
  { label: "Vermelho", value: "#dc2626" },
  { label: "Azul", value: "#2563eb" },
  { label: "Verde", value: "#16a34a" },
  { label: "Âmbar", value: "#d97706" },
];

/**
 * Editor rico (contentEditable). Na saída normaliza HTML com sanitizeTrailHtml
 * para o post renderizar igual ao que foi editado.
 */
export function TrailRichEditor({
  label,
  value,
  onChange,
  placeholder = "Escreva a descrição da trilha…",
  className,
  minHeight = 140,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const lastEmitted = useRef(value);
  const skipSync = useRef(false);

  // Sync externo → editor
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (skipSync.current) {
      skipSync.current = false;
      return;
    }
    if (value !== lastEmitted.current) {
      el.innerHTML = value || "";
      lastEmitted.current = value;
    }
  }, [value]);

  // seed inicial
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!el.innerHTML && value) {
      el.innerHTML = value;
      lastEmitted.current = value;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emit = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    // Normaliza no blur/comandos; no input mantém cru para cursor estável
    const raw = el.innerHTML;
    lastEmitted.current = raw;
    skipSync.current = true;
    onChange(raw);
  }, [onChange]);

  const emitNormalized = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const clean = sanitizeTrailHtml(el.innerHTML);
    // só reescreve DOM se mudou estrutura (evita pular caret em digitação)
    if (clean !== el.innerHTML) {
      // preserva seleção aproximada: reescreve só se for comando de toolbar
      el.innerHTML = clean;
    }
    lastEmitted.current = clean;
    skipSync.current = true;
    onChange(clean);
  }, [onChange]);

  function focusEditor() {
    ref.current?.focus();
  }

  function run(cmd: string, arg?: string) {
    focusEditor();
    try {
      document.execCommand(cmd, false, arg);
    } catch {
      /* ignore */
    }
    emitNormalized();
  }

  function setBlock(tag: "p" | "h1" | "h2" | "h3") {
    focusEditor();
    try {
      // Chrome exige <h1>, Firefox aceita h1
      document.execCommand("formatBlock", false, `<${tag}>`);
    } catch {
      try {
        document.execCommand("formatBlock", false, tag);
      } catch {
        /* ignore */
      }
    }
    emitNormalized();
  }

  function setFont(family: string) {
    if (!family) {
      // remove font-family do span selecionado se possível
      run("removeFormat");
      return;
    }
    focusEditor();
    try {
      document.execCommand("fontName", false, family);
    } catch {
      /* ignore */
    }
    emitNormalized();
  }

  function setColor(color: string) {
    if (!color) {
      run("foreColor", "#1f1f1f");
      return;
    }
    run("foreColor", color);
  }

  function setHighlight(color: string) {
    focusEditor();
    if (!color) {
      try {
        document.execCommand("removeFormat", false);
      } catch {
        /* ignore */
      }
      emitNormalized();
      return;
    }
    try {
      // prefer hiliteColor (Chrome)
      const ok = document.execCommand("hiliteColor", false, color);
      if (!ok) document.execCommand("backColor", false, color);
    } catch {
      try {
        document.execCommand("backColor", false, color);
      } catch {
        /* ignore */
      }
    }
    emitNormalized();
  }

  function addLink() {
    const url = window.prompt("URL do link (https://…)");
    if (!url?.trim()) return;
    let href = url.trim();
    if (!/^https?:\/\//i.test(href) && !href.startsWith("/")) {
      href = `https://${href}`;
    }
    run("createLink", href);
  }

  const toolBtn =
    "inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-1.5 text-[12px] font-semibold text-neutral-600 transition hover:bg-neutral-100 hover:text-[#1f1f1f]";

  return (
    <div className={cn("flex w-full flex-col gap-2", className)}>
      {label ? (
        <label className="text-[13px] font-medium text-[var(--text-primary)]">
          {label}
        </label>
      ) : null}

      <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] focus-within:ring-2 focus-within:ring-[var(--accent)] focus-within:ring-offset-2">
        <div className="flex flex-wrap items-center gap-0.5 border-b border-neutral-100 bg-neutral-50/80 px-1.5 py-1.5 dark:border-zinc-800 dark:bg-zinc-900/50">
          <button
            type="button"
            className={toolBtn}
            title="Título grande"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setBlock("h1")}
          >
            <TextH size={15} weight="bold" />
            <span className="ml-0.5 text-[10px]">1</span>
          </button>
          <button
            type="button"
            className={toolBtn}
            title="Subtítulo"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setBlock("h2")}
          >
            <TextH size={14} weight="bold" />
            <span className="ml-0.5 text-[10px]">2</span>
          </button>
          <button
            type="button"
            className={toolBtn}
            title="Parágrafo"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setBlock("p")}
          >
            P
          </button>

          <span className="mx-1 h-4 w-px bg-neutral-200" />

          <button
            type="button"
            className={toolBtn}
            title="Negrito"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => run("bold")}
          >
            <TextB size={15} weight="bold" />
          </button>
          <button
            type="button"
            className={toolBtn}
            title="Itálico"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => run("italic")}
          >
            <TextItalic size={15} />
          </button>
          <button
            type="button"
            className={toolBtn}
            title="Sublinhado"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => run("underline")}
          >
            <TextUnderline size={15} />
          </button>

          <span className="mx-1 h-4 w-px bg-neutral-200" />

          <select
            className="h-8 max-w-[7.5rem] rounded-lg border-0 bg-transparent px-1 text-[11px] font-medium text-neutral-600 outline-none"
            title="Fonte"
            defaultValue=""
            onMouseDown={(e) => e.stopPropagation()}
            onChange={(e) => setFont(e.target.value)}
          >
            {FONTS.map((f) => (
              <option key={f.label} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>

          <select
            className="h-8 max-w-[6.5rem] rounded-lg border-0 bg-transparent px-1 text-[11px] font-medium text-neutral-600 outline-none"
            title="Cor do texto"
            defaultValue=""
            onMouseDown={(e) => e.stopPropagation()}
            onChange={(e) => setColor(e.target.value)}
          >
            {TEXT_COLORS.map((c) => (
              <option key={c.label} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>

          <select
            className="h-8 max-w-[6.5rem] rounded-lg border-0 bg-transparent px-1 text-[11px] font-medium text-neutral-600 outline-none"
            title="Destacar"
            defaultValue=""
            onMouseDown={(e) => e.stopPropagation()}
            onChange={(e) => setHighlight(e.target.value)}
          >
            {HIGHLIGHTS.map((c) => (
              <option key={c.label} value={c.value}>
                {c.label === "Nenhum" ? "Marca" : c.label}
              </option>
            ))}
          </select>

          <span className="mx-1 h-4 w-px bg-neutral-200" />

          <button
            type="button"
            className={toolBtn}
            title="Lista"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => run("insertUnorderedList")}
          >
            <ListBullets size={15} />
          </button>
          <button
            type="button"
            className={toolBtn}
            title="Lista numerada"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => run("insertOrderedList")}
          >
            <ListNumbers size={15} />
          </button>
          <button
            type="button"
            className={toolBtn}
            title="Link"
            onMouseDown={(e) => e.preventDefault()}
            onClick={addLink}
          >
            <LinkIcon size={15} weight="bold" />
          </button>
        </div>

        <div className="relative">
          {!stripPreview(value) && (
            <p className="pointer-events-none absolute left-3 top-3 z-[1] text-[15px] text-[var(--text-tertiary)]">
              {placeholder}
            </p>
          )}
          <div
            ref={ref}
            role="textbox"
            aria-multiline
            contentEditable
            suppressContentEditableWarning
            className={cn(TRAIL_RICH_BODY_CLASS, "px-3 py-3 outline-none")}
            style={{ minHeight }}
            onInput={emit}
            onBlur={emitNormalized}
          />
        </div>
      </div>
      <p className="text-[11px] text-neutral-400">
        A formatação publicada usa o mesmo estilo do editor (títulos, listas,
        cores e destaques).
      </p>
    </div>
  );
}

function stripPreview(html: string) {
  return (html || "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
}

/** Render da descrição — mesmas classes do editor */
export function TrailRichHtml({
  html,
  className,
}: {
  html: string;
  className?: string;
}) {
  const safe =
    typeof document !== "undefined" ? sanitizeTrailHtml(html) : html;

  return (
    <div
      className={cn(TRAIL_RICH_BODY_CLASS, className)}
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}
