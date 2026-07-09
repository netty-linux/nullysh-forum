export type UserRole = "member" | "vip" | "admin";

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  bio: string;
  avatar: string;
  role: UserRole;
  isVip: boolean;
  createdAt: string;
  updatedAt: string;
}

export type UserPublic = Omit<User, "password">;

export interface Community {
  id: string;
  name: string;
  slug: string;
  description: string;
  members: number;
  posts: number;
  icon: string;
  color: string;
  vipOnly: boolean;
}

export interface Post {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  communityId?: string;
  communityName?: string;
  title: string;
  content: string;
  type: "discussion" | "news" | "tutorial" | "announcement";
  likes: number;
  comments: number;
  likedBy: string[];
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
}

export interface Material {
  id: string;
  title: string;
  description: string;
  type: "pdf" | "template" | "checklist" | "link" | "course";
  category: string;
  size?: string;
  vipOnly: boolean;
  downloads: number;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  channelId: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  content: string;
  createdAt: string;
}

export interface ChatChannel {
  id: string;
  name: string;
  description: string;
  vipOnly: boolean;
}
