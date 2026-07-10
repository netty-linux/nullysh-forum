import type { AvatarFrameId } from "@/lib/avatar-frames";
import { isAvatarFrameId } from "@/lib/avatar-frames";
import {
  normalizeBadgeEquipped,
  normalizeBadgesUnlocked,
} from "@/lib/emblems";
import { normalizeFavoriteTracks, type FavoriteTrack } from "@/lib/music";
import {
  normalizeBannerFit,
  type BannerFit,
  type ProfileLink,
  type User,
  type UserPublic,
  type UserRole,
} from "@/lib/types";
import { initials } from "@/lib/utils";

/** Linha da tabela public.profiles */
export type ProfileRow = {
  id: string;
  email: string;
  name: string;
  bio: string | null;
  avatar: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  banner_fit: unknown;
  avatar_frame: string | null;
  role: UserRole | string;
  is_vip: boolean;
  is_verified: boolean;
  interests: unknown;
  goals: unknown;
  seeking_mentorship: boolean;
  offering_mentorship: boolean;
  mentor_topics: unknown;
  links: unknown;
  favorite_tracks: unknown;
  badges_unlocked?: unknown;
  badge_equipped?: string | null;
  created_at: string;
  updated_at: string;
};

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

function asLinks(v: unknown): ProfileLink[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((l) => l && typeof l === "object" && typeof (l as ProfileLink).url === "string")
    .map((l) => {
      const item = l as ProfileLink;
      return {
        id: item.id || `link_${Math.random().toString(36).slice(2, 8)}`,
        label: (item.label || "").trim(),
        url: item.url.trim(),
      };
    });
}

export function profileRowToUser(row: ProfileRow): UserPublic {
  const role = (["member", "vip", "admin"].includes(row.role)
    ? row.role
    : "member") as UserRole;

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    bio: row.bio ?? "",
    avatar: row.avatar || initials(row.name) || "U",
    avatarUrl: row.avatar_url,
    bannerUrl: row.banner_url,
    bannerFit: normalizeBannerFit(row.banner_fit),
    avatarFrame: isAvatarFrameId(row.avatar_frame)
      ? (row.avatar_frame as AvatarFrameId)
      : null,
    role,
    isVip: !!row.is_vip,
    isVerified: !!row.is_verified,
    interests: asStringArray(row.interests),
    goals: asStringArray(row.goals),
    seekingMentorship: !!row.seeking_mentorship,
    offeringMentorship: !!row.offering_mentorship,
    mentorTopics: asStringArray(row.mentor_topics),
    links: asLinks(row.links),
    favoriteTracks: normalizeFavoriteTracks(row.favorite_tracks),
    badgesUnlocked: (() => {
      const unlocked = normalizeBadgesUnlocked(row.badges_unlocked);
      return unlocked;
    })(),
    badgeEquipped: (() => {
      const unlocked = normalizeBadgesUnlocked(row.badges_unlocked);
      return normalizeBadgeEquipped(row.badge_equipped, unlocked);
    })(),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Payload de update para profiles (snake_case) */
export function userUpdateToRow(
  data: Partial<
    Pick<
      User,
      | "name"
      | "bio"
      | "email"
      | "avatarUrl"
      | "bannerUrl"
      | "bannerFit"
      | "avatarFrame"
      | "interests"
      | "goals"
      | "seekingMentorship"
      | "offeringMentorship"
      | "mentorTopics"
      | "links"
      | "favoriteTracks"
      | "badgesUnlocked"
      | "badgeEquipped"
      | "isVip"
      | "isVerified"
      | "role"
      | "avatar"
    >
  >
): Record<string, unknown> {
  const row: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (data.name !== undefined) row.name = data.name;
  if (data.bio !== undefined) row.bio = data.bio;
  if (data.email !== undefined) row.email = data.email;
  if (data.avatar !== undefined) row.avatar = data.avatar;
  if (data.avatarUrl !== undefined) row.avatar_url = data.avatarUrl;
  if (data.bannerUrl !== undefined) row.banner_url = data.bannerUrl;
  if (data.bannerFit !== undefined) row.banner_fit = data.bannerFit;
  if (data.avatarFrame !== undefined) row.avatar_frame = data.avatarFrame;
  if (data.interests !== undefined) row.interests = data.interests;
  if (data.goals !== undefined) row.goals = data.goals;
  if (data.seekingMentorship !== undefined)
    row.seeking_mentorship = data.seekingMentorship;
  if (data.offeringMentorship !== undefined)
    row.offering_mentorship = data.offeringMentorship;
  if (data.mentorTopics !== undefined) row.mentor_topics = data.mentorTopics;
  if (data.links !== undefined) row.links = data.links;
  if (data.favoriteTracks !== undefined)
    row.favorite_tracks = data.favoriteTracks;
  if (data.badgesUnlocked !== undefined)
    row.badges_unlocked = data.badgesUnlocked;
  if (data.badgeEquipped !== undefined) row.badge_equipped = data.badgeEquipped;
  if (data.isVip !== undefined) row.is_vip = data.isVip;
  if (data.isVerified !== undefined) row.is_verified = data.isVerified;
  if (data.role !== undefined) row.role = data.role;

  return row;
}

export type { BannerFit, FavoriteTrack };
