"use client";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { VipBadge } from "@/components/vip-gate";
import { useAuth } from "@/hooks/use-auth";
import { useForumStore } from "@/lib/forum-store";
import type { Post } from "@/lib/types";
import { cn, formatRelative } from "@/lib/utils";
import {
  ChatCircle,
  Heart,
  Lock,
} from "@phosphor-icons/react";
import Link from "next/link";

const typeLabel: Record<Post["type"], string> = {
  discussion: "Discussão",
  news: "Notícia",
  tutorial: "Tutorial",
  announcement: "Aviso",
};

export function PostCard({ post }: { post: Post }) {
  const { user, isVip } = useAuth();
  const toggleLike = useForumStore((s) => s.toggleLike);
  const locked = post.vipOnly && !isVip;
  const liked = user ? post.likedBy.includes(user.id) : false;

  return (
    <article
      className={cn(
        "rounded-2xl border border-neutral-200/80 bg-white p-5 transition-colors sm:p-6",
        locked && "relative overflow-hidden"
      )}
    >
      <div className={cn(locked && "pointer-events-none select-none blur-[3px] opacity-50")}>
        <div className="flex items-start gap-3">
          <Avatar name={post.authorAvatar || post.authorName} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-neutral-950">
                {post.authorName}
              </span>
              {post.communityName && (
                <span className="text-xs text-neutral-400">
                  em {post.communityName}
                </span>
              )}
              <span className="text-xs text-neutral-400">
                {formatRelative(post.createdAt)}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge variant="outline">{typeLabel[post.type]}</Badge>
              {post.vipOnly && <VipBadge />}
            </div>
          </div>
        </div>

        <h3 className="mt-4 text-base font-semibold tracking-tight text-neutral-950 sm:text-lg">
          {post.title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600">
          {post.content}
        </p>

        <div className="mt-4 flex items-center gap-4">
          <button
            type="button"
            disabled={!user || locked}
            onClick={() => user && toggleLike(post.id, user.id)}
            className={cn(
              "inline-flex items-center gap-1.5 text-sm transition-colors",
              liked ? "text-neutral-950" : "text-neutral-400 hover:text-neutral-950",
              (!user || locked) && "cursor-not-allowed opacity-50"
            )}
          >
            <Heart size={16} weight={liked ? "fill" : "regular"} />
            {post.likes}
          </button>
          <span className="inline-flex items-center gap-1.5 text-sm text-neutral-400">
            <ChatCircle size={16} />
            {post.comments}
          </span>
        </div>
      </div>

      {locked && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/40 p-4 backdrop-blur-[1px]">
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-950 shadow-sm transition-colors hover:border-neutral-400"
          >
            <Lock size={14} weight="bold" />
            Conteúdo VIP
          </Link>
        </div>
      )}
    </article>
  );
}
