/**
 * Cliente de GIFs — busca via /api/gifs (Tenor + Giphy).
 * Pesquisa por nome em toda a rede de GIFs (não só catálogo local).
 *
 * `url` = variante LEVE para o feed (nunca original giphy.gif).
 */

import { lightenGifUrl } from "@/lib/gif-optimize";

export type GifItem = {
  id: string;
  title: string;
  previewUrl: string;
  url: string;
  mp4Url?: string | null;
  width: number;
  height: number;
};

const FALLBACK_GIFS: GifItem[] = [
  {
    id: "fallback-this-is-fine",
    title: "This is fine",
    previewUrl: "https://media.giphy.com/media/NTur7XlVDUdqM/100w.webp",
    url: "https://media.giphy.com/media/NTur7XlVDUdqM/200w.webp",
    mp4Url: "https://media.giphy.com/media/NTur7XlVDUdqM/200w.mp4",
    width: 200,
    height: 112,
  },
  {
    id: "fallback-mind-blown",
    title: "Mind blown",
    previewUrl: "https://media.giphy.com/media/26ufdipQqU2lhNA4g/100w.webp",
    url: "https://media.giphy.com/media/26ufdipQqU2lhNA4g/200w.webp",
    mp4Url: "https://media.giphy.com/media/26ufdipQqU2lhNA4g/200w.mp4",
    width: 200,
    height: 112,
  },
  {
    id: "fallback-thumbs-up",
    title: "Thumbs up",
    previewUrl: "https://media.giphy.com/media/111ebonMs90YLu/100w.webp",
    url: "https://media.giphy.com/media/111ebonMs90YLu/200w.webp",
    mp4Url: "https://media.giphy.com/media/111ebonMs90YLu/200w.mp4",
    width: 200,
    height: 258,
  },
  {
    id: "fallback-clap",
    title: "Clap",
    previewUrl: "https://media.giphy.com/media/7rj2ZgttXaw3e/100w.webp",
    url: "https://media.giphy.com/media/7rj2ZgttXaw3e/200w.webp",
    mp4Url: "https://media.giphy.com/media/7rj2ZgttXaw3e/200w.mp4",
    width: 200,
    height: 112,
  },
  {
    id: "fallback-cat-type",
    title: "Cat typing",
    previewUrl: "https://media.giphy.com/media/JIX9t2j0ZTN9S/100w.webp",
    url: "https://media.giphy.com/media/JIX9t2j0ZTN9S/200w.webp",
    mp4Url: "https://media.giphy.com/media/JIX9t2j0ZTN9S/200w.mp4",
    width: 200,
    height: 200,
  },
  {
    id: "fallback-popcorn",
    title: "Popcorn",
    previewUrl: "https://media.giphy.com/media/tXL4FHPSnVJ0A/100w.webp",
    url: "https://media.giphy.com/media/tXL4FHPSnVJ0A/200w.webp",
    mp4Url: "https://media.giphy.com/media/tXL4FHPSnVJ0A/200w.mp4",
    width: 200,
    height: 112,
  },
];

function normalizeGifItem(g: GifItem): GifItem {
  return {
    ...g,
    // garante que posts novos nunca guardem original pesado
    url: lightenGifUrl(g.url),
    previewUrl: lightenGifUrl(g.previewUrl || g.url),
  };
}

async function fetchFromApi(
  query: string,
  limit = 28
): Promise<{ gifs: GifItem[]; source: string }> {
  const params = new URLSearchParams({
    limit: String(limit),
  });
  if (query.trim()) params.set("q", query.trim());

  const res = await fetch(`/api/gifs?${params.toString()}`, {
    cache: "no-store",
  });
  const data = (await res.json()) as {
    ok?: boolean;
    gifs?: GifItem[];
    source?: string;
  };
  return {
    gifs: (data.gifs || []).map(normalizeGifItem),
    source: data.source || "none",
  };
}

export async function fetchTrendingGifs(limit = 28): Promise<GifItem[]> {
  try {
    const { gifs } = await fetchFromApi("", limit);
    return gifs.length ? gifs : FALLBACK_GIFS;
  } catch {
    return FALLBACK_GIFS;
  }
}

export async function searchGifs(
  query: string,
  limit = 28
): Promise<GifItem[]> {
  const q = query.trim();
  if (!q) return fetchTrendingGifs(limit);

  try {
    const { gifs } = await fetchFromApi(q, limit);
    if (gifs.length) return gifs;

    const lower = q.toLowerCase();
    const local = FALLBACK_GIFS.filter((g) =>
      g.title.toLowerCase().includes(lower)
    );
    return local.length ? local : FALLBACK_GIFS;
  } catch {
    return FALLBACK_GIFS;
  }
}

/** URL leve para persistir em posts/comentários. */
export function pickGifPostUrl(g: GifItem): string {
  return lightenGifUrl(g.url || g.previewUrl);
}
