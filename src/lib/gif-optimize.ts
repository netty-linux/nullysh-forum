/**
 * Otimização de GIFs — Nullysh
 *
 * Estratégia sênior:
 * 1) Nunca servir o original Giphy/Tenor no feed (pode ter 5–15 MB).
 * 2) Preferir WebP animado (~200w) ou MP4 (fixed_width) — 10–50× menor.
 * 3) Lazy real: só decodifica quando entra no viewport (+ rootMargin).
 * 4) Posts antigos com /giphy.gif são reescritos no client em tempo de render.
 */

/** Extrai ID Giphy de URLs comuns. */
export function extractGiphyId(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("giphy.com")) return null;
    // /media/{id}/...
    const media = u.pathname.match(/\/media\/([a-zA-Z0-9]+)\//);
    if (media?.[1]) return media[1];
    // i.giphy.com/{id}.gif  |  giphy.com/gifs/...-{id}
    const bare = u.pathname.match(/\/([a-zA-Z0-9]+)(?:\.gif)?$/i);
    if (bare?.[1] && bare[1] !== "media" && bare[1] !== "gifs") {
      return bare[1];
    }
    const slug = u.pathname.match(/-([a-zA-Z0-9]+)$/);
    if (slug?.[1]) return slug[1];
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Reescreve URL pesada → variante leve para o feed.
 * Preferência: sempre 200w.webp no Giphy (tipicamente 50–300 KB vs 5–15 MB).
 */
export function lightenGifUrl(url: string): string {
  if (!url) return url;
  const id = extractGiphyId(url);
  if (id) {
    // Já é 100w/200w webp — ok
    if (/\/(100w|200w)\.webp(\?|$)/i.test(url)) return url;
    return `https://media.giphy.com/media/${id}/200w.webp`;
  }

  // Tenor: reduz quando o path tem tier de tamanho
  try {
    const u = new URL(url);
    if (u.hostname.includes("tenor.com")) {
      return url
        .replace(/\/AAAP\d+\//, "/AAAP1/")
        .replace(/\/AAAAd\//, "/AAAPo/");
    }
  } catch {
    /* ignore */
  }

  return url;
}

/** Candidato MP4 (muito mais barato p/ CPU/rede que GIF animado). */
export function gifMp4Url(url: string): string | null {
  const id = extractGiphyId(url);
  if (!id) return null;
  return `https://media.giphy.com/media/${id}/200w.mp4`;
}

/** Preview minúsculo p/ picker / skeleton. */
export function gifTinyPreviewUrl(url: string): string {
  const id = extractGiphyId(url);
  if (id) return `https://media.giphy.com/media/${id}/100w.webp`;
  return lightenGifUrl(url);
}

/** True se a URL parece mídia animada de GIF CDN. */
export function isGifLikeUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return /giphy\.com|tenor\.com|\.gif(\?|$)/i.test(url);
}
