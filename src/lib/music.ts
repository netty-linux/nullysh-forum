import { normalizeUrl } from "./utils";

export type MusicPlatform = "spotify" | "youtube" | "soundcloud";

export type FavoriteTrack = {
  id: string;
  title: string;
  /** Artista / canal / uploader */
  artist: string;
  url: string;
  platform: MusicPlatform;
  thumbnailUrl?: string | null;
  /** URL do player embutido (iframe src) */
  embedUrl?: string | null;
};

export type MusicMetaResult = {
  platform: MusicPlatform;
  title: string;
  artist: string;
  thumbnailUrl: string | null;
  embedUrl: string | null;
  canonicalUrl: string;
};

export const MAX_FAVORITE_TRACKS_VIP = 6;
export const MAX_FAVORITE_TRACKS_FREE = 0;

export function maxFavoriteTracks(isVip: boolean) {
  return isVip ? MAX_FAVORITE_TRACKS_VIP : MAX_FAVORITE_TRACKS_FREE;
}

export function detectMusicPlatform(url: string): MusicPlatform | null {
  try {
    const host = new URL(normalizeUrl(url)).hostname
      .replace(/^www\./, "")
      .toLowerCase();

    if (
      host === "spotify.com" ||
      host.endsWith(".spotify.com") ||
      host === "open.spotify.com" ||
      host === "spoti.fi"
    ) {
      return "spotify";
    }
    if (
      host === "youtube.com" ||
      host.endsWith(".youtube.com") ||
      host === "youtu.be" ||
      host === "m.youtube.com" ||
      host === "music.youtube.com"
    ) {
      return "youtube";
    }
    if (
      host === "soundcloud.com" ||
      host.endsWith(".soundcloud.com") ||
      host === "on.soundcloud.com"
    ) {
      return "soundcloud";
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function isValidMusicUrl(url: string): boolean {
  return detectMusicPlatform(url) !== null;
}

export const MUSIC_PLATFORM_META: Record<
  MusicPlatform,
  { label: string; color: string; placeholder: string }
> = {
  spotify: {
    label: "Spotify",
    color: "#1DB954",
    placeholder: "https://open.spotify.com/track/…",
  },
  youtube: {
    label: "YouTube",
    color: "#FF0000",
    placeholder: "https://youtube.com/watch?v=…",
  },
  soundcloud: {
    label: "SoundCloud",
    color: "#FF5500",
    placeholder: "https://soundcloud.com/…",
  },
};

/** Extrai ID de vídeo do YouTube */
export function parseYoutubeId(url: string): string | null {
  try {
    const u = new URL(normalizeUrl(url));
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    if (host === "youtu.be") {
      return u.pathname.split("/").filter(Boolean)[0] || null;
    }
    if (host.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return v;
      const parts = u.pathname.split("/").filter(Boolean);
      // /embed/ID, /shorts/ID, /live/ID
      const i = parts.findIndex((p) =>
        ["embed", "shorts", "live", "v"].includes(p)
      );
      if (i >= 0 && parts[i + 1]) return parts[i + 1];
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** Converte URL Spotify em embed (track/album/playlist/episode) */
export function buildSpotifyEmbedUrl(url: string): string | null {
  try {
    const u = new URL(normalizeUrl(url));
    const parts = u.pathname.split("/").filter(Boolean);
    // open.spotify.com/track/ID or /intl-pt/track/ID
    const types = ["track", "album", "playlist", "episode", "show", "artist"];
    let typeIdx = -1;
    for (let i = 0; i < parts.length; i++) {
      if (types.includes(parts[i])) {
        typeIdx = i;
        break;
      }
    }
    if (typeIdx < 0 || !parts[typeIdx + 1]) return null;
    const type = parts[typeIdx];
    const id = parts[typeIdx + 1].split("?")[0];
    return `https://open.spotify.com/embed/${type}/${id}?utm_source=generator&theme=0`;
  } catch {
    return null;
  }
}

export function buildYoutubeEmbedUrl(url: string): string | null {
  const id = parseYoutubeId(url);
  if (!id) return null;
  return `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1`;
}

export function buildSoundcloudEmbedUrl(url: string): string {
  const encoded = encodeURIComponent(normalizeUrl(url));
  return `https://w.soundcloud.com/player/?url=${encoded}&color=%231f1f1f&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false&visual=false`;
}

export function buildEmbedUrl(
  platform: MusicPlatform,
  url: string
): string | null {
  if (platform === "spotify") return buildSpotifyEmbedUrl(url);
  if (platform === "youtube") return buildYoutubeEmbedUrl(url);
  if (platform === "soundcloud") return buildSoundcloudEmbedUrl(url);
  return null;
}

/**
 * Separa título e artista de strings oEmbed comuns:
 * "Song Name - Artist", "Artist – Song", "Artist: Song"
 */
export function splitTitleArtist(
  title: string,
  authorName?: string
): { title: string; artist: string } {
  const raw = (title || "").trim();
  const author = (authorName || "").trim();

  // YouTube Music / oEmbed: "Artist - Topic" as author, title is song
  if (author && / - Topic$/i.test(author)) {
    return {
      title: raw || "Faixa",
      artist: author.replace(/ - Topic$/i, "").trim(),
    };
  }

  const seps = [" - ", " – ", " — ", " | ", ": "];
  for (const sep of seps) {
    if (raw.includes(sep)) {
      const [a, ...rest] = raw.split(sep);
      const b = rest.join(sep).trim();
      if (a.trim() && b) {
        // Heurística: se author bate com um lado, usa o outro como título
        if (author && a.trim().toLowerCase() === author.toLowerCase()) {
          return { title: b, artist: a.trim() };
        }
        if (author && b.toLowerCase() === author.toLowerCase()) {
          return { title: a.trim(), artist: b };
        }
        // Padrão Spotify oEmbed: "track name" only, artist in author
        // Padrão YT: "Artist - Title" or "Title"
        // Prefer author as artist when present and short split
        if (author && author.length < 80) {
          // "Song (Official Video)" style — author is channel
          if (sep === " - " || sep === " – ") {
            return { title: b || raw, artist: a.trim() };
          }
        }
        return { title: a.trim(), artist: b };
      }
    }
  }

  return {
    title: raw || "Faixa",
    artist: author || "Artista desconhecido",
  };
}

export function normalizeFavoriteTracks(raw: unknown): FavoriteTrack[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (t) =>
        t &&
        typeof t === "object" &&
        typeof (t as FavoriteTrack).url === "string" &&
        (t as FavoriteTrack).url.trim()
    )
    .map((t) => {
      const item = t as Partial<FavoriteTrack>;
      const url = (item.url || "").trim();
      const platform =
        item.platform &&
        ["spotify", "youtube", "soundcloud"].includes(item.platform)
          ? (item.platform as MusicPlatform)
          : detectMusicPlatform(url) || "spotify";
      const embedUrl =
        item.embedUrl || buildEmbedUrl(platform, url) || null;
      return {
        id: item.id || `trk_${Math.random().toString(36).slice(2, 9)}`,
        title: (item.title || "").trim() || "Faixa",
        artist: (item.artist || "").trim() || "",
        url,
        platform,
        thumbnailUrl: item.thumbnailUrl ?? null,
        embedUrl,
      };
    });
}

/** Client: busca metadados via API interna */
export async function fetchMusicMeta(
  url: string
): Promise<
  { ok: true; data: MusicMetaResult } | { ok: false; error: string }
> {
  try {
    const res = await fetch(
      `/api/music/meta?url=${encodeURIComponent(normalizeUrl(url))}`
    );
    const json = (await res.json()) as
      | MusicMetaResult
      | { error?: string };
    if (!res.ok) {
      return {
        ok: false,
        error:
          ("error" in json && json.error) ||
          "Não foi possível obter os dados da música.",
      };
    }
    return { ok: true, data: json as MusicMetaResult };
  } catch {
    return {
      ok: false,
      error: "Falha de rede ao buscar a música.",
    };
  }
}
