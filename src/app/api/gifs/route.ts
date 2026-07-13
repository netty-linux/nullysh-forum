import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type GifItem = {
  id: string;
  title: string;
  /** Miniatura do picker (bem leve) */
  previewUrl: string;
  /** URL salva no post / feed (leve, nunca original) */
  url: string;
  /** MP4 opcional p/ feed ainda mais barato */
  mp4Url?: string | null;
  width: number;
  height: number;
};

type GiphyImage = {
  url?: string;
  webp?: string;
  mp4?: string;
  width?: string;
  height?: string;
};

type GiphyGif = {
  id: string;
  title?: string;
  images?: {
    fixed_width?: GiphyImage;
    fixed_width_small?: GiphyImage;
    fixed_width_downsampled?: GiphyImage;
    preview_gif?: GiphyImage;
    preview_webp?: GiphyImage;
    downsized?: GiphyImage;
    downsized_small?: GiphyImage;
    downsized_medium?: GiphyImage;
    original?: GiphyImage;
  };
};

/**
 * Mapeia Giphy → sempre variantes leves.
 * Nunca devolve original/giphy.gif no `url` (evita 5–15 MB no feed).
 */
function mapGiphy(g: GiphyGif): GifItem | null {
  const img = g.images || {};

  // Picker: o menor possível
  const previewUrl =
    img.fixed_width_small?.webp ||
    img.fixed_width_small?.url ||
    img.preview_webp?.url ||
    img.preview_gif?.url ||
    img.fixed_width_downsampled?.url ||
    img.fixed_width?.webp ||
    img.fixed_width?.url;

  // Feed: ~200px webp/gif — fluido no mobile
  const displayUrl =
    img.fixed_width?.webp ||
    img.fixed_width?.url ||
    img.downsized?.url ||
    img.fixed_width_downsampled?.url ||
    previewUrl;

  const mp4Url =
    img.fixed_width?.mp4 ||
    img.downsized_small?.mp4 ||
    img.original?.mp4 ||
    null;

  if (!previewUrl || !displayUrl) return null;

  return {
    id: `giphy-${g.id}`,
    title: g.title || "GIF",
    previewUrl,
    url: displayUrl,
    mp4Url,
    width: Number(
      img.fixed_width?.width ||
        img.fixed_width_small?.width ||
        img.original?.width ||
        200
    ),
    height: Number(
      img.fixed_width?.height ||
        img.fixed_width_small?.height ||
        img.original?.height ||
        200
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
