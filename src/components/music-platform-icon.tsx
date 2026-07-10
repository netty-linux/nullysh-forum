"use client";

import {
  detectMusicPlatform,
  type MusicPlatform,
} from "@/lib/music";
import { cn, normalizeUrl } from "@/lib/utils";
import {
  SpotifyLogo,
  YoutubeLogo,
  // Soundcloud — se não existir no bundle, usamos fallback SVG
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";

/** Ícone SoundCloud (Phosphor pode não exportar em todas as versões) */
function SoundcloudGlyph({
  size = 16,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M1.175 12.223c-.051 0-.094.046-.101.1l-.233 2.154.233 2.105c.007.058.05.098.101.098.05 0 .09-.04.099-.098l.255-2.105-.27-2.154c-.009-.054-.049-.1-.084-.1zm1.257-.506c-.06 0-.114.047-.12.113l-.22 2.647.22 2.563c.007.068.06.115.12.115.056 0 .11-.047.117-.115l.253-2.568-.253-2.644c-.007-.066-.06-.113-.117-.113zm1.51.089c-.07 0-.13.055-.136.126l-.206 2.432.206 2.39c.007.07.066.124.136.124.067 0 .126-.054.134-.124l.237-2.39-.237-2.432c-.008-.07-.067-.126-.134-.126zm1.556-.71c-.078 0-.144.062-.15.142l-.191 3.14.191 2.965c.006.08.072.142.15.142.076 0 .142-.062.15-.142l.22-2.965-.22-3.14c-.008-.08-.074-.142-.15-.142zm1.56-.18c-.085 0-.16.072-.165.16l-.184 3.32.184 3.047c.005.088.08.16.165.16.084 0 .16-.072.166-.16l.212-3.047-.212-3.32c-.006-.088-.082-.16-.166-.16zm1.48-1.47c-.018-.094-.098-.164-.191-.164-.096 0-.176.07-.192.164l-.174 4.79.174 3.19c.016.1.096.17.192.17.093 0 .173-.07.191-.17l.2-3.19-.2-4.79zm1.53.33c-.106 0-.195.084-.202.19l-.16 4.46.16 3.14c.007.106.096.19.202.19.105 0 .195-.084.202-.19l.184-3.14-.184-4.46c-.007-.106-.097-.19-.202-.19zm8.13 1.38c-.24-.16-.53-.25-.84-.25-.18 0-.36.03-.53.09-.2-2.26-2.1-4.03-4.42-4.03-.5 0-.99.08-1.45.23-.15.05-.2.1-.2.22v9.46c0 .13.1.23.23.23h6.37c1.3 0 2.36-1.06 2.36-2.36 0-1.02-.66-1.9-1.52-2.25z" />
    </svg>
  );
}

const META: Record<
  MusicPlatform,
  { Icon: Icon | typeof SoundcloudGlyph; className: string; label: string }
> = {
  spotify: {
    Icon: SpotifyLogo,
    className: "text-[#1DB954]",
    label: "Spotify",
  },
  youtube: {
    Icon: YoutubeLogo,
    className: "text-[#FF0000]",
    label: "YouTube",
  },
  soundcloud: {
    Icon: SoundcloudGlyph,
    className: "text-[#FF5500]",
    label: "SoundCloud",
  },
};

export function MusicPlatformIcon({
  platform,
  url,
  size = 16,
  className,
}: {
  platform?: MusicPlatform | null;
  url?: string;
  size?: number;
  className?: string;
}) {
  const resolved =
    platform || (url ? detectMusicPlatform(normalizeUrl(url)) : null) || "spotify";
  const { Icon, className: colorClass, label } = META[resolved];

  if (resolved === "soundcloud") {
    return (
      <SoundcloudGlyph
        size={size}
        className={cn("shrink-0", colorClass, className)}
      />
    );
  }

  return (
    <Icon
      size={size}
      weight="fill"
      className={cn("shrink-0", colorClass, className)}
      aria-label={label}
    />
  );
}

export function musicPlatformLabel(platform: MusicPlatform) {
  return META[platform].label;
}
