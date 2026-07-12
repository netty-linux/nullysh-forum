/**
 * Tipos do schema Supabase (domínio multi-user).
 * Mantidos à mão — alinhar com supabase/migrations/*.sql
 *
 * profiles / posts já existiam no init; P1 adiciona hashtag + RLS admin.
 */

export type UserRoleDb = "member" | "vip" | "admin";
export type PostTypeDb = "discussion" | "news" | "tutorial" | "announcement";

export type ProfileRow = {
  id: string;
  email: string;
  username: string | null;
  name: string;
  bio: string | null;
  avatar: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  banner_fit: unknown;
  avatar_frame: string | null;
  role: UserRoleDb | string;
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

export type PostRow = {
  id: string;
  author_id: string;
  author_name: string;
  author_avatar: string;
  author_avatar_url: string | null;
  community_id: string | null;
  community_name: string | null;
  title: string | null;
  content: string;
  image_url: string | null;
  location: string | null;
  type: PostTypeDb | string;
  likes: number;
  comments_count: number;
  liked_by: string[] | null;
  vip_only: boolean;
  hashtag: string | null;
  created_at: string;
};

/** Join posts + profiles (select com embed) */
export type PostWithAuthorRow = PostRow & {
  profiles?: Pick<
    ProfileRow,
    "id" | "username" | "name" | "avatar" | "avatar_url" | "is_vip" | "role"
  > | null;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Partial<ProfileRow> & { id: string; email: string; name: string };
        Update: Partial<ProfileRow>;
      };
      posts: {
        Row: PostRow;
        Insert: {
          id?: string;
          author_id: string;
          author_name: string;
          author_avatar?: string;
          author_avatar_url?: string | null;
          community_id?: string | null;
          community_name?: string | null;
          title?: string | null;
          content: string;
          image_url?: string | null;
          location?: string | null;
          type?: PostTypeDb;
          likes?: number;
          comments_count?: number;
          liked_by?: string[];
          vip_only?: boolean;
          hashtag?: string | null;
          created_at?: string;
        };
        Update: Partial<PostRow>;
      };
    };
  };
};
