/**
 * Helpers de música no post (validação, normalização, limites).
 *
 * Arquitetura anti-bloat (sem áudio no nosso storage):
 * - Guardamos só JSON leve em posts.music (~0.5–2 KB): url, título, artista,
 *   platform, embedUrl, thumbnailUrl (CDN da plataforma), startAt + clip.
 * - O áudio toca via embed YouTube/Spotify/SoundCloud no client — zero MB
 *   de áudio no Supabase/R2.
 * - clipDurationSec max 60s; startAt max 600s.
 * - Futuro se hospedarmos clip: R2 + AAC 96–128kbps, max 30s, hard cap 400KB,
 *   geração server-side (ffmpeg), nunca data-URL no Postgres.
 */

import type { PostMusic } from "@/lib/types";
import {
  buildEmbedUrl,
  detectMusicPlatform,
  isValidMusicUrl,
  type MusicPlatform,
} from "@/lib/music";

export const POST_MUSIC_CLIP_DEFAULT = 30;
export const POST_MUSIC_CLIP_MIN = 10;
export const POST_MUSIC_CLIP_MAX = 60;
export const POST_MUSIC_START_MAX = 600;

export function clampPostMusicStart(sec: number): number {
  if (!Number.isFinite(sec) || sec < 0) return 0;
  return Math.min(POST_MUSIC_START_MAX, Math.floor(sec));
}

export function clampPostMusicClip(sec: number): number {
  if (!Number.isFinite(sec)) return POST_MUSIC_CLIP_DEFAULT;
  return Math.min(
    POST_MUSIC_CLIP_MAX,
    Math.max(POST_MUSIC_CLIP_MIN, Math.floor(sec))
  );
}

export function normalizePostMusic(raw: unknown): PostMusic | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const url = typeof o.url === "string" ? o.url.trim() : "";
  if (!url || !isValidMusicUrl(url)) return null;

  const platform =
    (typeof o.platform === "string" &&
    ["spotify", "youtube", "soundcloud"].includes(o.platform)
      ? o.platform
      : detectMusicPlatform(url)) as MusicPlatform | null;
  if (!platform) return null;

  const title =
    typeof o.title === "string" && o.title.trim()
      ? o.title.trim().slice(0, 120)
      : "Faixa";
  const artist =
    typeof o.artist === "string" && o.artist.trim()
      ? o.artist.trim().slice(0, 120)
      : "";

  const embedUrl =
    (typeof o.embedUrl === "string" && o.embedUrl.trim()) ||
    buildEmbedUrl(platform, url) ||
    null;

  return {
    title,
    artist,
    url,
    platform,
    thumbnailUrl:
      typeof o.thumbnailUrl === "string" ? o.thumbnailUrl : null,
    embedUrl,
    startAtSec: clampPostMusicStart(Number(o.startAtSec ?? 0)),
    clipDurationSec: clampPostMusicClip(
      Number(o.clipDurationSec ?? POST_MUSIC_CLIP_DEFAULT)
    ),
  };
}

export function postMusicToJson(m: PostMusic): Record<string, unknown> {
  return {
    title: m.title,
    artist: m.artist,
    url: m.url,
    platform: m.platform,
    thumbnailUrl: m.thumbnailUrl ?? null,
    embedUrl: m.embedUrl ?? null,
    startAtSec: m.startAtSec,
    clipDurationSec: m.clipDurationSec,
  };
}
