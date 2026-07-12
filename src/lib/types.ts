import type { AvatarFrameId } from "./avatar-frames";
import type { EmblemId } from "./emblems";
import type { FavoriteTrack, MusicPlatform } from "./music";

export type UserRole = "member" | "vip" | "admin";

export type { AvatarFrameId };
export type { EmblemId };
export type { FavoriteTrack, MusicPlatform };

export interface User {
  id: string;
  name: string;
  /**
   * Handle público (@username) — único, editável.
   * Usado para buscar/exibir perfil. Nunca é o e-mail.
   */
  username: string;
  /**
   * E-mail de cadastro — PRIVADO.
   * Só o próprio dono da conta deve ver/editar. Não exibir em perfil público.
   */
  email: string;
  password: string;
  bio: string;
  /** Inicial(is) de fallback quando não há foto */
  avatar: string;
  /** Foto de perfil (data URL ou URL) */
  avatarUrl: string | null;
  /** Banner do perfil (data URL ou URL) */
  bannerUrl: string | null;
  /**
   * Enquadramento do banner (útil p/ GIF animado — sem re-encodar).
   * x/y: object-position 0–100; zoom: 1–2.5
   */
  bannerFit: BannerFit | null;
  /**
   * Moldura sazonal do avatar (VIP).
   * Free ignora na UI; VIP escolhe entre 6 frames estilo Nitro.
   */
  avatarFrame: AvatarFrameId | null;
  role: UserRole;
  isVip: boolean;
  /** Selo de verificado (estilo Instagram / X) */
  isVerified: boolean;
  /** Tags de interesse (IA, programação, pantheon...) */
  interests: string[];
  /** Objetivos em texto livre (ex.: quero ser expert em IA) */
  goals: string[];
  /** Quer receber mentoria */
  seekingMentorship: boolean;
  /** Oferece mentoria */
  offeringMentorship: boolean;
  /** Temas em que mentoraria (subset de interesses) */
  mentorTopics: string[];
  /** Links clicáveis na bio (1 free / 6 VIP) */
  links: ProfileLink[];
  /**
   * Músicas favoritas / “ouvindo agora” (VIP).
   * Spotify, YouTube ou SoundCloud — até 6.
   */
  favoriteTracks: FavoriteTrack[];
  /** Emblemas desbloqueados (conquistas) — todos salvos na conta */
  badgesUnlocked: EmblemId[];
  /** Emblema fixo visível no perfil (apenas 1) */
  badgeEquipped: EmblemId | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileLink {
  id: string;
  /** Rótulo opcional (ex.: Instagram, Site) */
  label: string;
  url: string;
}

/** Campos editáveis do perfil (local + Supabase) */
export type ProfileUpdate = Partial<
  Pick<
    User,
    | "name"
    | "username"
    | "bio"
    | "email"
    | "password"
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
  >
>;

/**
 * Dados seguros para exibir o perfil de OUTRA pessoa.
 * Sem e-mail nem senha.
 */
export type UserCard = Omit<User, "password" | "email">;

/** Posição/zoom do banner (GIF ou imagem cobrindo o frame 3:1) */
export interface BannerFit {
  /** 0–100, eixo X (object-position) */
  x: number;
  /** 0–100, eixo Y (object-position) */
  y: number;
  /** 1 = caber, até 2.5 = zoom in */
  zoom: number;
}

export const DEFAULT_BANNER_FIT: BannerFit = { x: 50, y: 50, zoom: 1 };

export function normalizeBannerFit(raw: unknown): BannerFit | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<BannerFit>;
  const x = Number(r.x);
  const y = Number(r.y);
  const zoom = Number(r.zoom);
  if (![x, y, zoom].every((n) => Number.isFinite(n))) return null;
  return {
    x: Math.min(100, Math.max(0, x)),
    y: Math.min(100, Math.max(0, y)),
    zoom: Math.min(2.5, Math.max(1, zoom)),
  };
}

export interface TrailProgress {
  trailId: string;
  completedStepIds: string[];
  startedAt: string;
  updatedAt: string;
}

export interface EventRsvp {
  eventId: string;
  userId: string;
  createdAt: string;
}

export type UserPublic = Omit<User, "password">;

export type VerificationStatus = "pending" | "approved" | "rejected";

export interface VerificationRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  /** Por que pede verificação */
  reason: string;
  /** Quem é / o que faz */
  identity: string;
  /** Links de redes / site (prova social) */
  links: string;
  /** Como usa a comunidade */
  communityUse: string;
  /** Declaração anti-fake */
  isRealPerson: boolean;
  status: VerificationStatus;
  adminNote: string;
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
}

/** Quem pode ler posts dentro da comunidade */
export type CommunityAccess = "everyone" | "vip";

/** Origem da comunidade */
export type CommunitySource = "staff" | "member";

/**
 * Quem pode incluir a #hashtag ao publicar.
 * - everyone: free, VIP e admin
 * - admin: só role admin (ex.: #staff em Anúncios Oficiais)
 */
export type CommunityTagPolicy = "everyone" | "admin";

export interface Community {
  id: string;
  name: string;
  slug: string;
  description: string;
  /**
   * Palavra-chave de sync (sem #).
   * Ex.: "staff", "geral", "vips"
   * Posts com #palavra entram na comunidade.
   */
  hashtag: string;
  members: number;
  posts: number;
  icon: string;
  color: string;
  /**
   * true = só VIP lê posts (legado / atalho).
   * Preferir `access` quando disponível.
   */
  vipOnly: boolean;
  /** Quem pode abrir e ler posts da comunidade */
  access: CommunityAccess;
  /** Quem pode marcar a #hashtag ao postar */
  tagPolicy: CommunityTagPolicy;
  /** staff = oficial Nullysh; member = criada por VIP */
  source: CommunitySource;
  creatorId: string;
  creatorName: string;
  createdAt: string;
}

/**
 * Música do post (estilo Instagram Reels/Feed).
 * Toca quando o card está centralizado no viewport.
 */
export type PostMusic = {
  title: string;
  artist: string;
  url: string;
  platform: MusicPlatform;
  thumbnailUrl?: string | null;
  embedUrl?: string | null;
  /** Início do trecho (s) definido pelo autor */
  startAtSec: number;
  /** Duração do loop do trecho (s) — default 30 */
  clipDurationSec: number;
};

export interface Post {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  authorAvatarUrl?: string | null;
  communityId?: string;
  communityName?: string;
  /** Opcional — posts estilo X usam só content */
  title?: string;
  content: string;
  /** Imagem do post (data URL ou URL) */
  imageUrl?: string | null;
  /** GIF do post (URL https Giphy) */
  gifUrl?: string | null;
  /** Localização livre (ex.: São Paulo, BR) */
  location?: string | null;
  /** Música em destaque no post (estilo IG) */
  music?: PostMusic | null;
  type: "discussion" | "news" | "tutorial" | "announcement";
  likes: number;
  dislikes: number;
  comments: number;
  likedBy: string[];
  dislikedBy: string[];
  /** IDs de usuários que salvaram o post */
  savedBy: string[];
  createdAt: string;
  vipOnly: boolean;
}

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  content: string;
  createdAt: string;
  /** ids de quem curtiu o comentário */
  likedBy?: string[];
  /**
   * Comentário raiz: null.
   * Resposta: id do comentário de topo da thread (1 nível de aninhamento).
   */
  parentId?: string | null;
  /** Nome de quem está sendo respondido (exibição “Respondendo a X”) */
  replyToName?: string | null;
  replyToAuthorId?: string | null;
  /** GIF no comentário (URL https Giphy) — opcional */
  gifUrl?: string | null;
}

/** Repost (estilo X) — o post original aparece no feed do perfil de quem repostou */
export interface PostRepost {
  id: string;
  userId: string;
  userName: string;
  postId: string;
  createdAt: string;
}

export interface Video {
  id: string;
  title: string;
  description: string;
  duration: string;
  category: string;
  thumbnail: string;
  vipOnly: boolean;
  views: number;
  createdAt: string;
  /** true quando o arquivo está no Telegram e tem stream proxy */
  hasStream?: boolean;
  mimeType?: string;
  sizeBytes?: number;
  hasThumb?: boolean;
}

export type MaterialType =
  | "pdf"
  | "template"
  | "checklist"
  | "link"
  | "course";

export interface Material {
  id: string;
  title: string;
  description: string;
  type: MaterialType;
  category: string;
  size?: string;
  /** URL de download / link externo (opcional) */
  url?: string | null;
  vipOnly: boolean;
  downloads: number;
  createdAt: string;
  createdById?: string;
  createdByName?: string;
}

/** Tipo de payload de mídia no bate-papo */
export type ChatMediaKind =
  | "text"
  | "image"
  | "video"
  | "audio"
  | "sticker"
  | "gif";

/** Status de entrega estilo WhatsApp (só relevante para o autor) */
export type ChatDeliveryStatus = "sending" | "sent" | "delivered" | "read";

export interface ChatMessage {
  id: string;
  channelId: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  content: string;
  createdAt: string;
  /** Encaminhou um post do feed para o chat */
  sharedPostId?: string | null;
  /**
   * Tipo da mensagem. Default implícito: text (ou shared_post se sharedPostId).
   */
  mediaKind?: ChatMediaKind | null;
  /**
   * URL da mídia: data URL, https (GIF Giphy) ou ref IndexedDB `idb:chat:…`
   */
  mediaUrl?: string | null;
  mediaMime?: string | null;
  /** Duração em segundos (áudio/vídeo) */
  mediaDuration?: number | null;
  /** Thumbnail opcional (vídeo) */
  mediaThumbUrl?: string | null;
  /** Largura/altura exibida (sticker/gif) */
  mediaWidth?: number | null;
  mediaHeight?: number | null;
  /**
   * Reações estilo Instagram: emoji → ids de quem reagiu
   * ex.: { "❤️": ["u1","u2"], "😂": ["u3"] }
   */
  reactions?: Record<string, string[]>;
  /** IDs de quem recebeu a mensagem (não o autor) */
  deliveredTo?: string[];
  /** IDs de quem leu (abriu a sala depois da msg) */
  readBy?: string[];
}

export interface ChatChannel {
  id: string;
  name: string;
  description: string;
  vipOnly: boolean;
}
