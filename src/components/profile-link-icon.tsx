"use client";

import { normalizeUrl } from "@/lib/utils";
import {
  DiscordLogo,
  FacebookLogo,
  GithubLogo,
  InstagramLogo,
  LinkSimple,
  RedditLogo,
  XLogo,
  YoutubeLogo,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";

type SocialKind =
  | "instagram"
  | "facebook"
  | "reddit"
  | "youtube"
  | "x"
  | "github"
  | "discord"
  | "generic";

function detectSocial(url: string): SocialKind {
  try {
    const host = new URL(normalizeUrl(url)).hostname
      .replace(/^www\./, "")
      .toLowerCase();

    if (
      host === "instagram.com" ||
      host.endsWith(".instagram.com") ||
      host === "instagr.am"
    ) {
      return "instagram";
    }
    if (
      host === "facebook.com" ||
      host.endsWith(".facebook.com") ||
      host === "fb.com" ||
      host === "fb.me" ||
      host === "m.facebook.com"
    ) {
      return "facebook";
    }
    if (
      host === "reddit.com" ||
      host.endsWith(".reddit.com") ||
      host === "redd.it"
    ) {
      return "reddit";
    }
    if (
      host === "youtube.com" ||
      host.endsWith(".youtube.com") ||
      host === "youtu.be" ||
      host === "m.youtube.com"
    ) {
      return "youtube";
    }
    if (
      host === "x.com" ||
      host === "twitter.com" ||
      host.endsWith(".twitter.com") ||
      host === "mobile.twitter.com" ||
      host === "t.co"
    ) {
      return "x";
    }
    if (
      host === "github.com" ||
      host.endsWith(".github.com") ||
      host === "gist.github.com"
    ) {
      return "github";
    }
    if (
      host === "discord.com" ||
      host.endsWith(".discord.com") ||
      host === "discord.gg" ||
      host === "discordapp.com" ||
      host.endsWith(".discordapp.com")
    ) {
      return "discord";
    }
  } catch {
    /* ignore */
  }
  return "generic";
}

const MAP: Record<
  SocialKind,
  { Icon: Icon; className: string; weight?: "fill" | "bold" | "regular" }
> = {
  instagram: {
    Icon: InstagramLogo,
    className: "text-[#E4405F]",
    weight: "fill",
  },
  facebook: {
    Icon: FacebookLogo,
    className: "text-[#1877F2]",
    weight: "fill",
  },
  reddit: {
    Icon: RedditLogo,
    className: "text-[#FF4500]",
    weight: "fill",
  },
  youtube: {
    Icon: YoutubeLogo,
    className: "text-[#FF0000]",
    weight: "fill",
  },
  x: {
    Icon: XLogo,
    className: "text-[#1f1f1f]",
    weight: "bold",
  },
  github: {
    Icon: GithubLogo,
    className: "text-[#24292F]",
    weight: "fill",
  },
  discord: {
    Icon: DiscordLogo,
    className: "text-[#5865F2]",
    weight: "fill",
  },
  generic: {
    Icon: LinkSimple,
    className: "text-neutral-400",
    weight: "bold",
  },
};

export function ProfileLinkIcon({
  url,
  size = 14,
  className,
}: {
  url: string;
  size?: number;
  className?: string;
}) {
  const kind = detectSocial(url);
  const { Icon, className: colorClass, weight } = MAP[kind];
  return (
    <Icon
      size={size}
      weight={weight}
      className={["shrink-0", colorClass, className].filter(Boolean).join(" ")}
      aria-hidden
    />
  );
}

export function socialKindFromUrl(url: string): SocialKind {
  return detectSocial(url);
}
