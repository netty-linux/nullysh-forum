/**
 * Helpers de HTML para descrições de trilha (editor rico).
 * contentEditable gera <font>, <div>, estilos inline — normalizamos
 * para tags semânticas + span com style seguro, para o post bater com o editor.
 */

/** Remove tags para validar comprimento / preview */
export function stripHtml(html: string): string {
  return (html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/h[1-3]>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const ALLOWED_TAGS = new Set([
  "p",
  "div",
  "br",
  "h1",
  "h2",
  "h3",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "strike",
  "span",
  "mark",
  "a",
  "ul",
  "ol",
  "li",
  "blockquote",
  "font", // convertido → span, depois removido
]);

const STYLE_PROPS = [
  "color",
  "background-color",
  "background",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "text-decoration",
] as const;

function filterStyle(style: string): string {
  return style
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => {
      const prop = s.split(":")[0]?.trim().toLowerCase() || "";
      return STYLE_PROPS.some((p) => p === prop);
    })
    .map((s) => {
      // background → background-color se for cor simples
      if (/^background\s*:/i.test(s) && !/^background-color\s*:/i.test(s)) {
        return s.replace(/^background/i, "background-color");
      }
      return s;
    })
    .join("; ");
}

function rgbToHex(value: string): string {
  const m = value.match(
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i
  );
  if (!m) return value.trim();
  const r = Number(m[1]).toString(16).padStart(2, "0");
  const g = Number(m[2]).toString(16).padStart(2, "0");
  const b = Number(m[3]).toString(16).padStart(2, "0");
  return `#${r}${g}${b}`;
}

function normalizeColorInStyle(style: string): string {
  return style.replace(
    /(color|background-color)\s*:\s*([^;]+)/gi,
    (_, prop: string, val: string) => `${prop}: ${rgbToHex(val.trim())}`
  );
}

/**
 * Converte lixo do contentEditable em HTML estável:
 * - <font color/face/size> → <span style="…">
 * - <b>/<i> mantidos
 * - estilos perigosos removidos
 */
export function sanitizeTrailHtml(input: string): string {
  if (!input || typeof input !== "string") return "";

  if (typeof document === "undefined") {
    // Fallback SSR: strip scripts, handlers e hrefs perigosos
    return input
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
      .replace(/on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
      .replace(/\s(href|src|xlink:href)\s*=\s*("|')\s*javascript:[^"']*\2/gi, "")
      .replace(/\s(href|src)\s*=\s*("|')\s*data:[^"']*\2/gi, "");
  }

  const tpl = document.createElement("template");
  tpl.innerHTML = input;

  function convertFont(el: HTMLElement) {
    const styles: string[] = [];
    const color = el.getAttribute("color");
    const face = el.getAttribute("face");
    const size = el.getAttribute("size");
    if (color) styles.push(`color: ${rgbToHex(color)}`);
    if (face) styles.push(`font-family: ${face}`);
    if (size) {
      // HTML font size 1–7 → approx px
      const map: Record<string, string> = {
        "1": "10px",
        "2": "13px",
        "3": "16px",
        "4": "18px",
        "5": "24px",
        "6": "32px",
        "7": "48px",
      };
      styles.push(`font-size: ${map[size] || "16px"}`);
    }
    const existing = el.getAttribute("style");
    if (existing) {
      const f = filterStyle(existing);
      if (f) styles.push(f);
    }
    const span = document.createElement("span");
    if (styles.length) {
      span.setAttribute("style", normalizeColorInStyle(styles.join("; ")));
    }
    while (el.firstChild) span.appendChild(el.firstChild);
    el.replaceWith(span);
    return span;
  }

  function clean(node: Node) {
    if (node.nodeType === Node.COMMENT_NODE) {
      node.parentNode?.removeChild(node);
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;

    let el = node as HTMLElement;
    let tag = el.tagName.toLowerCase();

    // font → span com style
    if (tag === "font") {
      el = convertFont(el);
      tag = "span";
    }

    // strike → s
    if (tag === "strike") {
      const s = document.createElement("s");
      while (el.firstChild) s.appendChild(el.firstChild);
      el.replaceWith(s);
      el = s;
      tag = "s";
    }

    if (!ALLOWED_TAGS.has(tag) || tag === "font") {
      // unwrap desconhecidos (mantém filhos)
      const parent = el.parentNode;
      if (parent) {
        const kids = Array.from(el.childNodes);
        for (const child of kids) {
          parent.insertBefore(child, el);
          clean(child);
        }
        parent.removeChild(el);
      }
      return;
    }

    // attributes
    const attrs = Array.from(el.attributes);
    for (const attr of attrs) {
      const name = attr.name.toLowerCase();
      if (name.startsWith("on") || name === "src" || name === "srcset") {
        el.removeAttribute(attr.name);
        continue;
      }

      if (tag === "a" && name === "href") {
        const href = attr.value.trim();
        // Bloqueia javascript:, data:, vbscript: e protocolos estranhos (XSS)
        const safe =
          /^(https?:\/\/|mailto:|\/(?!\/)|#)/i.test(href) &&
          !/^\s*javascript:/i.test(href) &&
          !/^\s*data:/i.test(href) &&
          !/^\s*vbscript:/i.test(href);
        if (!safe) {
          el.removeAttribute("href");
        } else {
          el.setAttribute("href", href);
          el.setAttribute("target", "_blank");
          el.setAttribute("rel", "noopener noreferrer nofollow");
        }
        continue;
      }

      if (name === "style") {
        // permite style em qualquer tag permitida (h1, p, span, li…)
        let style = filterStyle(attr.value);
        style = normalizeColorInStyle(style);
        if (style) el.setAttribute("style", style);
        else el.removeAttribute("style");
        continue;
      }

      if (name === "class") {
        const cls = attr.value
          .split(/\s+/)
          .filter((c) =>
            [
              "trail-h1",
              "trail-h2",
              "trail-h3",
              "trail-hl",
              "trail-p",
            ].includes(c)
          )
          .join(" ");
        if (cls) el.setAttribute("class", cls);
        else el.removeAttribute("class");
        continue;
      }

      // mark: mantém sem attrs perigosos
      if (
        name !== "href" &&
        name !== "style" &&
        name !== "class" &&
        name !== "target" &&
        name !== "rel"
      ) {
        el.removeAttribute(attr.name);
      }
    }

    // filhos (cópia — tree pode mutar)
    for (const child of Array.from(el.childNodes)) {
      clean(child);
    }
  }

  for (const child of Array.from(tpl.content.childNodes)) {
    clean(child);
  }

  // Se só veio texto solto / divs sem bloco, envolve em p quando útil
  let html = tpl.innerHTML.trim();

  // Chrome às vezes deixa <div><br></div> — ok
  // Garante que headings vazios não quebrem layout
  html = html.replace(/<h([1-3])>\s*<\/h\1>/gi, "");

  return html;
}

export function isEmptyTrailHtml(html: string): boolean {
  return stripHtml(html).length === 0;
}

/** Classes Tailwind compartilhadas: editor e visualização 1:1 */
export const TRAIL_RICH_BODY_CLASS = [
  "trail-rich-body max-w-none text-[15px] leading-[1.6] text-[#1f1f1f]",
  // blocos
  "[&_h1]:mb-3 [&_h1]:mt-1 [&_h1]:block [&_h1]:text-[28px] [&_h1]:font-semibold [&_h1]:leading-[1.2] [&_h1]:tracking-[-0.02em] [&_h1]:text-[#1f1f1f]",
  "[&_h2]:mb-2.5 [&_h2]:mt-1 [&_h2]:block [&_h2]:text-[22px] [&_h2]:font-semibold [&_h2]:leading-[1.25] [&_h2]:tracking-[-0.01em] [&_h2]:text-[#1f1f1f]",
  "[&_h3]:mb-2 [&_h3]:mt-1 [&_h3]:block [&_h3]:text-[18px] [&_h3]:font-semibold [&_h3]:leading-snug [&_h3]:text-[#1f1f1f]",
  "[&_p]:mb-3 [&_p]:block [&_p]:min-h-[1.25em]",
  "[&_div]:mb-2 [&_div]:block",
  "[&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-neutral-300 [&_blockquote]:pl-3 [&_blockquote]:text-neutral-600",
  // listas
  "[&_ul]:my-3 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6",
  "[&_ol]:my-3 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-6",
  "[&_li]:my-0.5 [&_li]:pl-0.5",
  // inline
  "[&_a]:font-medium [&_a]:text-sky-600 [&_a]:underline [&_a]:underline-offset-2",
  "[&_strong]:font-semibold [&_b]:font-semibold",
  "[&_em]:italic [&_i]:italic",
  "[&_u]:underline",
  "[&_s]:line-through [&_strike]:line-through",
  "[&_mark]:rounded-sm [&_mark]:bg-yellow-200 [&_mark]:px-0.5",
  // spans com highlight inline (background-color via style)
  "[&_span]:align-baseline",
].join(" ");
