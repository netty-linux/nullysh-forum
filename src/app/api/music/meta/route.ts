import {
  buildEmbedUrl,
  buildSoundcloudEmbedUrl,
  detectMusicPlatform,
  splitTitleArtist,
  type MusicMetaResult,
  type MusicPlatform,
} from "@/lib/music";
import { normalizeUrl } from "@/lib/utils";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type OEmbed = {
  title?: string;
  author_name?: string;
  thumbnail_url?: string;
  html?: string;
  provider_name?: string;
};

function oembedEndpoint(platform: MusicPlatform, url: string): string {
  const u = encodeURIComponent(url);
  if (platform === "youtube") {
    return `https://www.youtube.com/oembed?url=${u}&format=json`;
  }
  if (platform === "spotify") {
    return `https://open.spotify.com/oembed?url=${u}`;
  }
  // soundcloud
  return `https://soundcloud.com/oembed?format=json&url=${u}`;
}

function extractIframeSrc(html?: string): string | null {
  if (!html) return null;
  const m = html.match(/src=["']([^"']+)["']/i);
  return m?.[1] ?? null;
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url")?.trim();
  if (!raw) {
    return NextResponse.json({ error: "Informe a URL." }, { status: 400 });
  }

  let url: string;
  try {
    url = normalizeUrl(raw);
    // validate
    new URL(url);
  } catch {
    return NextResponse.json({ error: "URL inválida." }, { status: 400 });
  }

  const platform = detectMusicPlatform(url);
  if (!platform) {
    return NextResponse.json(
      {
        error:
          "Plataforma não suportada. Use Spotify, YouTube ou SoundCloud.",
      },
      { status: 400 }
    );
  }

  try {
    const endpoint = oembedEndpoint(platform, url);
    const res = await fetch(endpoint, {
      headers: {
        Accept: "application/json",
        "User-Agent": "NullyshForum/1.0 (music-meta)",
      },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      // Fallback: ainda monta embed sem oEmbed
      const embedUrl = buildEmbedUrl(platform, url);
      if (!embedUrl) {
        return NextResponse.json(
          { error: "Não encontramos essa faixa. Verifique o link." },
          { status: 404 }
        );
      }
      const fallback: MusicMetaResult = {
        platform,
        title: "Faixa",
        artist: MUSIC_FALLBACK_ARTIST[platform],
        thumbnailUrl: null,
        embedUrl,
        canonicalUrl: url,
      };
      return NextResponse.json(fallback);
    }

    const data = (await res.json()) as OEmbed;
    const split = splitTitleArtist(data.title || "", data.author_name);
    let embedUrl =
      extractIframeSrc(data.html) || buildEmbedUrl(platform, url);

    // SoundCloud oEmbed às vezes devolve player; normaliza visual compacto
    if (platform === "soundcloud") {
      embedUrl = buildSoundcloudEmbedUrl(url);
    }

    // Spotify: prefer our compact embed builder
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
      thumbnailUrl: data.thumbnail_url || null,
      embedUrl: embedUrl || null,
      canonicalUrl: url,
    };

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Falha ao consultar a plataforma de música." },
      { status: 502 }
    );
  }
}

const MUSIC_FALLBACK_ARTIST: Record<MusicPlatform, string> = {
  spotify: "Spotify",
  youtube: "YouTube",
  soundcloud: "SoundCloud",
};
