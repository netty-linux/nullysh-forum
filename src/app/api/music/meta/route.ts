import {
  buildEmbedUrl,
  buildSoundcloudEmbedUrl,
  detectMusicPlatform,
  parseYoutubeId,
  splitTitleArtist,
  type MusicMetaResult,
  type MusicPlatform,
} from "@/lib/music";
import { normalizeUrl } from "@/lib/utils";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const OEMBED_TIMEOUT_MS = 3500;

type OEmbed = {
  title?: string;
  author_name?: string;
  thumbnail_url?: string;
  html?: string;
  provider_name?: string;
};

const MUSIC_FALLBACK_ARTIST: Record<MusicPlatform, string> = {
  spotify: "Spotify",
  youtube: "YouTube",
  soundcloud: "SoundCloud",
};

function oembedEndpoint(platform: MusicPlatform, url: string): string {
  if (platform === "youtube") {
    return `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
  }
  if (platform === "spotify") {
    // oEmbed prefere URL canônica sem /intl-xx/
    const canonical = url.replace(
      /open\.spotify\.com\/intl-[a-z]{2}\//i,
      "open.spotify.com/"
    );
    return `https://open.spotify.com/oembed?url=${encodeURIComponent(canonical)}`;
  }
  return `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(url)}`;
}

function extractIframeSrc(html?: string): string | null {
  if (!html) return null;
  const m = html.match(/src=["']([^"']+)["']/i);
  return m?.[1] ?? null;
}

function youtubeThumb(url: string): string | null {
  const id = parseYoutubeId(url);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}

function localFallback(
  platform: MusicPlatform,
  url: string
): MusicMetaResult | null {
  const embedUrl = buildEmbedUrl(platform, url);
  if (!embedUrl) return null;
  return {
    platform,
    title: "Faixa",
    artist: MUSIC_FALLBACK_ARTIST[platform],
    thumbnailUrl: platform === "youtube" ? youtubeThumb(url) : null,
    embedUrl,
    canonicalUrl: url,
  };
}

function jsonOk(data: MusicMetaResult) {
  return NextResponse.json({ ok: true, data, ...data });
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url")?.trim();
  if (!raw) {
    return NextResponse.json(
      { ok: false, error: "Informe a URL." },
      { status: 400 }
    );
  }

  let url: string;
  try {
    url = normalizeUrl(raw);
    new URL(url);
  } catch {
    return NextResponse.json(
      { ok: false, error: "URL inválida." },
      { status: 400 }
    );
  }

  const platform = detectMusicPlatform(url);
  if (!platform) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Plataforma não suportada. Use Spotify, YouTube ou SoundCloud.",
      },
      { status: 400 }
    );
  }

  const fallback = localFallback(platform, url);

  try {
    const endpoint = oembedEndpoint(platform, url);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), OEMBED_TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(endpoint, {
        headers: {
          Accept: "application/json",
          "User-Agent":
            "Mozilla/5.0 (compatible; NullyshForum/1.0; +https://nullysh.com)",
        },
        signal: controller.signal,
        cache: "no-store",
      });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      if (fallback) return jsonOk(fallback);
      return NextResponse.json(
        { ok: false, error: "Não encontramos essa faixa. Verifique o link." },
        { status: 404 }
      );
    }

    const data = (await res.json()) as OEmbed;
    const split = splitTitleArtist(data.title || "", data.author_name);
    let embedUrl =
      extractIframeSrc(data.html) || buildEmbedUrl(platform, url);

    if (platform === "soundcloud") {
      embedUrl = buildSoundcloudEmbedUrl(url);
    }
    if (platform === "spotify") {
      embedUrl = buildEmbedUrl("spotify", url) || embedUrl;
    }

    const result: MusicMetaResult = {
      platform,
      title: split.title || data.title || "Faixa",
      artist:
        split.artist ||
        data.author_name ||
        MUSIC_FALLBACK_ARTIST[platform],
      thumbnailUrl:
        data.thumbnail_url ||
        (platform === "youtube" ? youtubeThumb(url) : null),
      embedUrl: embedUrl || fallback?.embedUrl || null,
      canonicalUrl: url,
    };

    return jsonOk(result);
  } catch {
    if (fallback) return jsonOk(fallback);
    return NextResponse.json(
      { ok: false, error: "Falha ao consultar a plataforma de música." },
      { status: 502 }
    );
  }
}
