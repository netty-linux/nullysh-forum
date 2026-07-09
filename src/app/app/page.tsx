"use client";

import { PostCard } from "@/components/post-card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { communities } from "@/lib/mock-data";
import { useForumStore } from "@/lib/forum-store";
import { FormEvent, useMemo, useState } from "react";

export default function FeedPage() {
  const { user } = useAuth();
  const posts = useForumStore((s) => s.posts);
  const createPost = useForumStore((s) => s.createPost);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [communityId, setCommunityId] = useState("");
  const [filter, setFilter] = useState<"all" | "mine">("all");

  const visible = useMemo(() => {
    let list = [...posts].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    if (filter === "mine" && user) {
      list = list.filter((p) => p.authorId === user.id);
    }
    return list;
  }, [posts, filter, user]);

  function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!user || !title.trim() || !content.trim()) return;
    const community = communities.find((c) => c.id === communityId);
    createPost({
      authorId: user.id,
      authorName: user.name,
      authorAvatar: user.avatar,
      title,
      content,
      communityId: community?.id,
      communityName: community?.name,
      type: "discussion",
      vipOnly: false,
    });
    setTitle("");
    setContent("");
    setCommunityId("");
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-950">
          Feed
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Olá, {user?.name?.split(" ")[0]}. Compartilhe, curta e acompanhe a
          comunidade.
        </p>
      </div>

      <form
        onSubmit={onCreate}
        className="mb-6 space-y-3 rounded-2xl border border-neutral-200/80 bg-white p-5"
      >
        <p className="text-sm font-medium text-neutral-950">Nova publicação</p>
        <Input
          placeholder="Título"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <Textarea
          placeholder="O que você quer compartilhar?"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
          className="min-h-[100px]"
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <select
            value={communityId}
            onChange={(e) => setCommunityId(e.target.value)}
            className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-700 focus:border-neutral-950 focus:outline-none"
          >
            <option value="">Sem comunidade</option>
            {communities
              .filter((c) => !c.vipOnly || user?.isVip)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
          <Button type="submit" disabled={!title.trim() || !content.trim()}>
            Publicar
          </Button>
        </div>
      </form>

      <div className="mb-4 flex gap-2">
        {(
          [
            ["all", "Todos"],
            ["mine", "Meus posts"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={
              filter === key
                ? "rounded-full bg-neutral-950 px-3 py-1.5 text-xs font-medium text-white"
                : "rounded-full bg-white px-3 py-1.5 text-xs font-medium text-neutral-500 ring-1 ring-neutral-200 hover:text-neutral-950"
            }
          >
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {visible.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
        {visible.length === 0 && (
          <div className="rounded-2xl border border-dashed border-neutral-200 bg-white p-10 text-center text-sm text-neutral-400">
            Nenhum post ainda. Seja o primeiro a publicar.
          </div>
        )}
      </div>
    </div>
  );
}
