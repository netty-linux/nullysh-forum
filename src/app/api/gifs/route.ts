import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type GifItem = {
  id: string;
  title: string;
  previewUrl: string;
  url: string;
  width: number;
  height: number;
};

type GiphyGif = {
  id: string;
  title?: string;
  images?: {
    fixed_width?: { url?: string; width?: string; height?: string };
    fixed_width_downsampled?: { url?: string; width?: string; height?: string };
    downsized?: { url?: string };
    downsized_medium?: { url?: string };
    original?: { url?: string; width?: string; height?: string };
  };
};

function mapGiphy(g: GiphyGif): GifItem | null {
  const preview =
    g.images?.fixed_width?.url ||
    g.images?.fixed_width_downsampled?.url ||
    g.images?.downsized?.url ||
    g.images?.original?.url;
  const original =
    g.images?.downsized_medium?.url ||
    g.images?.downsized?.url ||
    g.images?.original?.url ||
    preview;
  if (!preview || !original) return null;
  return {
    id: `giphy-${g.id}`,
    title: g.title || "GIF",
    previewUrl: preview,
    url: original,
    width: Number(g.images?.fixed_width?.width || g.images?.original?.width || 200),
    height: Number(
      g.images?.fixed_width?.height || g.images?.original?.height || 200
    ),
  };
}

/**
 * Busca GIFs de verdade na internet.
 * 1) Giphy API oficial (se GIPHY_API_KEY / NEXT_PUBLIC_GIPHY_API_KEY)
 * 2) Endpoint público do site Giphy (proxy-gif) — sem key, com busca por nome
 */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  const limit = Math.min(
    48,
    Math.max(8, Number(req.nextUrl.searchParams.get("limit") || 28) || 28)
  );

  const giphyKey =
    process.env.GIPHY_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_GIPHY_API_KEY?.trim() ||
    "";

  // 1) Giphy oficial
  if (giphyKey) {
    try {
      const path = q
        ? `https://api.giphy.com/v1/gifs/search?api_key=${encodeURIComponent(giphyKey)}&q=${encodeURIComponent(q)}&limit=${limit}&rating=pg-13&lang=pt`
        : `https://api.giphy.com/v1/gifs/trending?api_key=${encodeURIComponent(giphyKey)}&limit=${limit}&rating=pg-13`;
      const res = await fetch(path, { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { data?: GiphyGif[] };
        const list = (data.data || [])
          .map(mapGiphy)
          .filter((x): x is GifItem => !!x);
        if (list.length) {
          return NextResponse.json({
            ok: true,
            source: "giphy-api",
            gifs: list,
          });
        }
      }
    } catch (e) {
      console.warn("[api/gifs] giphy-api", e);
    }
  }

  // 2) Proxy público do Giphy.com (busca real sem API key)
  try {
    const term = q || "trending";
    const path = `https://giphy.com/api/v1/proxy-gif/search?q=${encodeURIComponent(term)}&limit=${limit}&offset=0`;
    const res = await fetch(path, {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Referer: "https://giphy.com/",
      },
      cache: "no-store",
    });
    if (res.ok) {
      const data = (await res.json()) as { data?: GiphyGif[] };
      const list = (data.data || [])
        .map(mapGiphy)
        .filter((x): x is GifItem => !!x);
      if (list.length) {
        return NextResponse.json({
          ok: true,
          source: "giphy-proxy",
          gifs: list,
          query: term,
        });
      }
    } else {
      console.warn("[api/gifs] proxy status", res.status);
    }
  } catch (e) {
    console.warn("[api/gifs] giphy-proxy", e);
  }

  return NextResponse.json({
    ok: false,
    source: "none",
    gifs: [],
    error: "Nenhum GIF encontrado. Tente outro termo.",
  });
}
