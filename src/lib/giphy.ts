/**
 * Cliente de GIFs — busca via /api/gifs (Tenor + Giphy).
 * Pesquisa por nome em toda a rede de GIFs (não só catálogo local).
 */

export type GifItem = {
  id: string;
  title: string;
  previewUrl: string;
  url: string;
  width: number;
  height: number;
};

const FALLBACK_GIFS: GifItem[] = [
  {
    id: "fallback-this-is-fine",
    title: "This is fine",
    previewUrl: "https://media.giphy.com/media/NTur7XlVDUdqM/200w.gif",
    url: "https://media.giphy.com/media/NTur7XlVDUdqM/giphy.gif",
    width: 480,
    height: 269,
  },
  {
    id: "fallback-mind-blown",
    title: "Mind blown",
    previewUrl: "https://media.giphy.com/media/26ufdipQqU2lhNA4g/200w.gif",
    url: "https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif",
    width: 480,
    height: 270,
  },
  {
    id: "fallback-thumbs-up",
    title: "Thumbs up",
    previewUrl: "https://media.giphy.com/media/111ebonMs90YLu/200w.gif",
    url: "https://media.giphy.com/media/111ebonMs90YLu/giphy.gif",
    width: 372,
    height: 480,
  },
  {
    id: "fallback-clap",
    title: "Clap",
    previewUrl: "https://media.giphy.com/media/7rj2ZgttXaw3e/200w.gif",
    url: "https://media.giphy.com/media/7rj2ZgttXaw3e/giphy.gif",
    width: 480,
    height: 270,
  },
  {
    id: "fallback-cat-type",
    title: "Cat typing",
    previewUrl: "https://media.giphy.com/media/JIX9t2j0ZTN9S/200w.gif",
    url: "https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif",
    width: 480,
    height: 480,
  },
  {
    id: "fallback-popcorn",
    title: "Popcorn",
    previewUrl: "https://media.giphy.com/media/tXL4FHPSnVJ0A/200w.gif",
    url: "https://media.giphy.com/media/tXL4FHPSnVJ0A/giphy.gif",
    width: 480,
    height: 270,
  },
];

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
    gifs: data.gifs || [],
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

    // fallback local se API falhar
    const lower = q.toLowerCase();
    const local = FALLBACK_GIFS.filter((g) =>
      g.title.toLowerCase().includes(lower)
    );
    return local.length ? local : FALLBACK_GIFS;
  } catch {
    return FALLBACK_GIFS;
  }
}
