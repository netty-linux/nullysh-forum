"use client";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { ForwardPostModal } from "@/components/forward-post-modal";
import { LazyGif } from "@/components/lazy-gif";
import { PostFeedMusic } from "@/components/post-feed-music";
import { ProfileHoverCard } from "@/components/profile-hover-card";
import { ProtectedMedia } from "@/components/protected-media";
import { ReportPostDialog } from "@/components/report-post-dialog";
import { RichText } from "@/components/rich-text";
import { Avatar } from "@/components/ui/avatar";
import { VerifiedBadge } from "@/components/verified-badge";
import { VipBadge } from "@/components/vip-gate";
import { useAuth } from "@/hooks/use-auth";
import { useAuthStore } from "@/lib/auth-store";
import { useForumStore } from "@/lib/forum-store";
import {
  canDownloadPostAttachments,
  downloadPostAttachment,
} from "@/lib/post-limits";
import {
  fetchTrendingGifs,
  pickGifPostUrl,
  searchGifs,
  type GifItem,
} from "@/lib/giphy";
import { consumeRateLimit } from "@/lib/rate-limit";
import type { Post } from "@/lib/types";
import { cn, formatRelative } from "@/lib/utils";
import {
  ArrowBendUpLeft,
  BookmarkSimple,
  ChatCircle,
  CrownSimple,
  DotsThree,
  DownloadSimple,
  Flag,
  Gif,
  Heart,
  Lock,
  MagnifyingGlass,
  MapPin,
  PaperPlaneTilt,
  Repeat,
  ShareNetwork,
  SpinnerGap,
  ThumbsDown,
  Trash,
  X,
} from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

const MAX_COMMENT = 400;

export function PostCard({
  post,
  repostMeta,
  focusCommentId,
  forceOpenComments,
  highlight,
}: {
  post: Post;
  /** Quando o card aparece por repost no feed/perfil */
  repostMeta?: { userId: string; userName: string; createdAt: string };
  /** Abre e destaca um comentário (deep-link de notificação) */
  focusCommentId?: string | null;
  forceOpenComments?: boolean;
  highlight?: boolean;
}) {
  const { user, isVip } = useAuth();
  const toggleLike = useForumStore((s) => s.toggleLike);
  const toggleDislike = useForumStore((s) => s.toggleDislike);
  const toggleSave = useForumStore((s) => s.toggleSave);
  const deletePost = useForumStore((s) => s.deletePost);
  const addComment = useForumStore((s) => s.addComment);
  const deleteComment = useForumStore((s) => s.deleteComment);
  const toggleCommentLike = useForumStore((s) => s.toggleCommentLike);
  const toggleRepost = useForumStore((s) => s.toggleRepost);
  const isReposted = useForumStore((s) => s.isReposted);
  const repostCount = useForumStore((s) => s.repostCount);
  const allComments = useForumStore((s) => s.comments);
  const reposts = useForumStore((s) => s.reposts);
  const users = useAuthStore((s) => s.users);
  void reposts;

  const author = users.find((u) => u.id === post.authorId);
  const isOwner = !!user && user.id === post.authorId;
  const isAdmin = user?.role === "admin";
  const vipPlan =
    !!isVip || user?.role === "admin" || user?.role === "vip";
  const canDelete = isOwner || isAdmin;
  /** Denunciar: posts de terceiros (não o próprio) */
  const canReport = !!user && !isOwner;
  const canDownload = canDownloadPostAttachments(vipPlan);
  const locked = post.vipOnly && !isVip;
  const showMenu = (canDelete || canReport) && !locked;
  const likedBy = post.likedBy ?? [];
  const dislikedBy = post.dislikedBy ?? [];
  const savedBy = post.savedBy ?? [];
  const liked = user ? likedBy.includes(user.id) : false;
  const disliked = user ? dislikedBy.includes(user.id) : false;
  const saved = user ? savedBy.includes(user.id) : false;
  const dislikes = post.dislikes ?? 0;
  const avatarSrc = author?.avatarUrl ?? post.authorAvatarUrl ?? null;

  const [pop, setPop] = useState(false);
  const [openComments, setOpenComments] = useState(false);
  const [draft, setDraft] = useState("");
  /** Comentário alvo da resposta (id do comentário clicado) */
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [replyToName, setReplyToName] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [gifPanelOpen, setGifPanelOpen] = useState(false);
  const [gifQ, setGifQ] = useState("");
  const [gifs, setGifs] = useState<GifItem[]>([]);
  const [gifLoading, setGifLoading] = useState(false);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);
  const [savePop, setSavePop] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [trashing, setTrashing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [forwardOpen, setForwardOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [repostPop, setRepostPop] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  const reposted =
    !!user && isReposted(post.id, user.id);
  const nReposts = repostCount(post.id);

  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  // Deep-link: abre comentários
  useEffect(() => {
    if (forceOpenComments || focusCommentId) {
      setOpenComments(true);
    }
  }, [forceOpenComments, focusCommentId]);

  const postComments = useMemo(
    () =>
      allComments
        .filter((c) => c.postId === post.id)
        .sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        ),
    [allComments, post.id]
  );

  // Deep-link: rola até o comentário
  useEffect(() => {
    if (!focusCommentId || !openComments) return;
    const t = window.setTimeout(() => {
      const el = document.getElementById(`comment-${focusCommentId}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 280);
    return () => window.clearTimeout(t);
  }, [focusCommentId, openComments, postComments]);

  // Contador real do store (não depende só do número seed no post)
  const commentCount = Math.max(post.comments, postComments.length);

  function onLike() {
    if (!user || locked) return;
    if (!liked) {
      setPop(true);
      window.setTimeout(() => setPop(false), 450);
    }
    void toggleLike(post.id, user.id);
  }

  function onDislike() {
    if (!user || locked) return;
    void toggleDislike(post.id, user.id);
  }

  function onRepost() {
    if (!user || locked) return;
    if (user.id === post.authorId) {
      setError("Você não pode repostar o próprio post.");
      return;
    }
    void (async () => {
      const res = await toggleRepost(post.id, user.id, user.name);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (res.reposted) {
        setRepostPop(true);
        window.setTimeout(() => setRepostPop(false), 400);
      }
      setError("");
    })();
  }

  function onDeleteComment(commentId: string) {
    if (!user) return;
    const res = deleteComment(commentId, user.id, {
      isAdmin: user.role === "admin",
    });
    if (!res.ok) setError(res.error);
  }

  function onSave() {
    if (!user || locked) return;
    if (!saved) {
      setSavePop(true);
      window.setTimeout(() => setSavePop(false), 450);
    }
    toggleSave(post.id, user.id);
  }

  function requestDelete() {
    if (!user || !canDelete || deleting || trashing) return;
    setMenuOpen(false);
    setConfirmDelete(true);
  }

  function requestReport() {
    if (!user || !canReport) return;
    setMenuOpen(false);
    setReportOpen(true);
  }

  async function onDownloadAttachment() {
    if (!post.imageUrl || downloading) return;
    if (!canDownload) {
      setError("Download de anexos é exclusivo do Plano VIP.");
      return;
    }
    setDownloading(true);
    setError("");
    try {
      await downloadPostAttachment(
        post.imageUrl,
        `nullysh-post-${post.id}`
      );
    } catch {
      setError("Não foi possível baixar o anexo.");
    } finally {
      setDownloading(false);
    }
  }

  function confirmDeletePost() {
    if (!user || !canDelete || deleting || trashing) return;
    setConfirmDelete(false);
    setDeleting(true);
    // animação “joga na lixeira”, depois remove do store + Supabase
    setTrashing(true);
    const delay = reduce ? 80 : 520;
    window.setTimeout(() => {
      void (async () => {
        const res = await deletePost(post.id, user.id, { isAdmin });
        if (!res.ok) {
          setError(res.error);
          setDeleting(false);
          setTrashing(false);
        }
      })();
    }, delay);
  }

  function toggleComments() {
    if (locked) return;
    setOpenComments((v) => !v);
    setError("");
    if (openComments) {
      setReplyToId(null);
      setReplyToName(null);
    }
  }

  function startReply(commentId: string, authorName: string) {
    if (!user || locked) return;
    setReplyToId(commentId);
    setReplyToName(authorName);
    setOpenComments(true);
    setError("");
    window.setTimeout(() => commentInputRef.current?.focus(), 80);
  }

  function cancelReply() {
    setReplyToId(null);
    setReplyToName(null);
  }

  // Carrega GIFs do painel de comentário
  useEffect(() => {
    if (!gifPanelOpen) return;
    let cancelled = false;
    setGifLoading(true);
    const t = window.setTimeout(async () => {
      try {
        const list = gifQ.trim()
          ? await searchGifs(gifQ, 24)
          : await fetchTrendingGifs(24);
        if (!cancelled) setGifs(list);
      } catch {
        if (!cancelled) setGifs([]);
      } finally {
        if (!cancelled) setGifLoading(false);
      }
    }, gifQ.trim() ? 350 : 0);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [gifPanelOpen, gifQ]);

  function onSubmitComment(e: FormEvent) {
    e.preventDefault();
    if (!user || locked) return;
    const text = draft.trim();
    if (!text) {
      setError(
        replyToId
          ? "Escreva uma resposta ou envie um GIF."
          : "Escreva um comentário ou envie um GIF."
      );
      return;
    }
    if (text.length > MAX_COMMENT) {
      setError(`Máximo de ${MAX_COMMENT} caracteres.`);
      return;
    }
    const rl = consumeRateLimit(user.id, "comment", {
      isVip: !!isVip || user.role === "vip",
      isAdmin: user.role === "admin",
    });
    if (!rl.ok) {
      setError(rl.error);
      return;
    }
    void (async () => {
      try {
        await addComment({
          postId: post.id,
          authorId: user.id,
          authorName: user.name,
          authorAvatar: user.avatar,
          content: text,
          replyToId,
        });
        setDraft("");
        setGifPanelOpen(false);
        setReplyToId(null);
        setReplyToName(null);
        setError("");
        setOpenComments(true);
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Não foi possível comentar."
        );
      }
    })();
  }

  function sendCommentGif(g: GifItem) {
    if (!user || locked) return;
    const rl = consumeRateLimit(user.id, "comment", {
      isVip: !!isVip || user.role === "vip",
      isAdmin: user.role === "admin",
    });
    if (!rl.ok) {
      setError(rl.error);
      return;
    }
    // Envia o GIF (+ legenda opcional se o usuário escreveu texto)
    void (async () => {
      try {
        await addComment({
          postId: post.id,
          authorId: user.id,
          authorName: user.name,
          authorAvatar: user.avatar,
          content: draft.trim(),
          replyToId,
          gifUrl: pickGifPostUrl(g),
        });
        setGifPanelOpen(false);
        setGifQ("");
        setDraft("");
        setReplyToId(null);
        setReplyToName(null);
        setError("");
        setOpenComments(true);
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Não foi possível enviar o GIF."
        );
      }
    })();
  }

  const rootComments = useMemo(
    () => postComments.filter((c) => !c.parentId),
    [postComments]
  );
  const repliesByParent = useMemo(() => {
    const map = new Map<string, typeof postComments>();
    for (const c of postComments) {
      if (!c.parentId) continue;
      const list = map.get(c.parentId) || [];
      list.push(c);
      map.set(c.parentId, list);
    }
    return map;
  }, [postComments]);

  const body = post.content?.trim();
  const hasTitle = !!(post.title && post.title.trim());

  return (
    <motion.article
      layout={!reduce && !trashing}
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={
        trashing
          ? reduce
            ? { opacity: 0 }
            : {
                opacity: 0,
                scale: 0.35,
                x: 80,
                y: 120,
                rotate: 18,
                filter: "blur(2px)",
              }
          : { opacity: 1, y: 0, scale: 1, x: 0, rotate: 0, filter: "blur(0px)" }
      }
      transition={
        trashing
          ? { duration: 0.48, ease: [0.4, 0, 0.2, 1] }
          : { type: "spring", stiffness: 400, damping: 32 }
      }
      id={`post-${post.id}`}
      style={{ transformOrigin: "top right" }}
      className={cn(
        "rounded-2xl border border-neutral-200/90 bg-white p-4 sm:p-5",
        "shadow-[0_1px_2px_rgb(0_0_0/0.04)]",
        locked && "relative overflow-hidden",
        trashing && "pointer-events-none z-10",
        highlight &&
          "ring-2 ring-rose-400 ring-offset-2 ring-offset-neutral-50 dark:ring-offset-[#0c0c0c]"
      )}
    >
      <div
        className={cn(
          locked && "pointer-events-none select-none blur-[3px] opacity-40"
        )}
      >
        {repostMeta && (
          <p className="mb-2 flex items-center gap-1.5 pl-1 text-[12px] font-semibold text-neutral-500 dark:text-zinc-400">
            <Repeat size={13} weight="bold" className="shrink-0" />
            <ProfileHoverCard
              userId={repostMeta.userId}
              fallback={{ name: repostMeta.userName }}
            >
              <Link
                href={`/app/u/${repostMeta.userId}`}
                className="hover:underline"
              >
                {user?.id === repostMeta.userId
                  ? "Você repostou"
                  : `${repostMeta.userName} repostou`}
              </Link>
            </ProfileHoverCard>
          </p>
        )}
        <div className="flex items-start gap-3">
          <ProfileHoverCard
            userId={post.authorId}
            fallback={{
              name: post.authorName,
              avatar: post.authorAvatar,
              avatarUrl: post.authorAvatarUrl ?? avatarSrc,
              isVerified: author?.isVerified,
              isVip: author?.isVip,
              avatarFrame: author?.avatarFrame,
            }}
          >
            <Link
              href={`/app/u/${post.authorId}`}
              className="avatar-link shrink-0"
            >
              <Avatar
                name={post.authorAvatar || post.authorName}
                src={avatarSrc}
                size="sm"
                frame={author?.isVip ? author.avatarFrame : null}
              />
            </Link>
          </ProfileHoverCard>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                <ProfileHoverCard
                  userId={post.authorId}
                  fallback={{
                    name: post.authorName,
                    avatar: post.authorAvatar,
                    avatarUrl: post.authorAvatarUrl ?? avatarSrc,
                    isVerified: author?.isVerified,
                    isVip: author?.isVip,
                    avatarFrame: author?.avatarFrame,
                  }}
                >
                  <Link
                    href={`/app/u/${post.authorId}`}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-[#1f1f1f] transition-colors hover:text-neutral-600 dark:text-zinc-100"
                  >
                    {post.authorName}
                    {author?.isVerified && <VerifiedBadge size={14} />}
                  </Link>
                </ProfileHoverCard>
                {post.vipOnly && <VipBadge />}
                <span className="text-xs text-neutral-400">
                  · {formatRelative(post.createdAt)}
                </span>
              </div>

              {showMenu && (
                <div className="relative shrink-0" ref={menuRef}>
                  <button
                    type="button"
                    onClick={() => setMenuOpen((v) => !v)}
                    disabled={deleting || trashing}
                    className={cn(
                      "inline-flex h-8 w-8 items-center justify-center rounded-full",
                      "text-neutral-400 transition",
                      "hover:bg-neutral-100 hover:text-[#1f1f1f]",
                      "dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
                      menuOpen &&
                        "bg-neutral-100 text-[#1f1f1f] dark:bg-zinc-800",
                      (deleting || trashing) && "pointer-events-none opacity-40"
                    )}
                    aria-label="Opções do post"
                    aria-expanded={menuOpen}
                    aria-haspopup="menu"
                    title="Opções"
                  >
                    <DotsThree size={20} weight="bold" />
                  </button>

                  <AnimatePresence>
                    {menuOpen && (
                      <motion.div
                        initial={
                          reduce ? false : { opacity: 0, y: -4, scale: 0.98 }
                        }
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={reduce ? undefined : { opacity: 0, y: -4 }}
                        transition={{ duration: 0.15 }}
                        role="menu"
                        className={cn(
                          "absolute right-0 top-full z-20 mt-1 min-w-[10.5rem] overflow-hidden",
                          "rounded-xl border border-neutral-200/90 bg-white py-1",
                          "shadow-[0_8px_28px_-8px_rgb(0_0_0/0.28)]",
                          "dark:border-zinc-700 dark:bg-zinc-900"
                        )}
                      >
                        {canReport && (
                          <button
                            type="button"
                            role="menuitem"
                            onClick={requestReport}
                            className={cn(
                              "flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] font-semibold",
                              "text-[#1f1f1f] transition hover:bg-neutral-50",
                              "dark:text-zinc-100 dark:hover:bg-zinc-800"
                            )}
                          >
                            <Flag
                              size={16}
                              weight="bold"
                              className="shrink-0 text-amber-600"
                            />
                            Denunciar
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            role="menuitem"
                            onClick={requestDelete}
                            disabled={deleting || trashing}
                            className={cn(
                              "flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] font-semibold",
                              "text-red-600 transition hover:bg-red-50",
                              "dark:text-red-400 dark:hover:bg-red-950/40",
                              (deleting || trashing) && "opacity-50"
                            )}
                          >
                            <Trash size={16} weight="bold" className="shrink-0" />
                            Apagar
                          </button>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {hasTitle && (
              <h3 className="mt-2 text-[15px] font-semibold tracking-tight text-[#1f1f1f] dark:text-zinc-100">
                {post.title}
              </h3>
            )}

            {body && body !== " " && (
              <p
                className={cn(
                  "text-[15px] leading-relaxed text-[#0f1419] dark:text-zinc-200",
                  hasTitle ? "mt-1.5" : "mt-1"
                )}
              >
                <RichText text={body} emojiSize={22} />
              </p>
            )}

            {/* GIF — LazyGif (MP4/WebP leve + IO, sem original pesado) */}
            {post.gifUrl && !locked && (
              <div className="mt-3 flex justify-start">
                <LazyGif
                  src={post.gifUrl}
                  alt="GIF"
                  className="max-w-[min(100%,280px)] rounded-2xl ring-1 ring-black/5 dark:ring-white/10"
                  maxHeightClass="max-h-52"
                />
              </div>
            )}
            {post.gifUrl && locked && (
              <div className="mt-3 flex h-40 max-w-[280px] items-center justify-center rounded-2xl bg-neutral-100 ring-1 ring-black/5 dark:bg-zinc-900">
                <Lock size={22} weight="bold" className="text-neutral-400" />
              </div>
            )}

            {post.imageUrl && !post.gifUrl && (
              <div className="relative mt-3 overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100 dark:border-zinc-700 dark:bg-zinc-900">
                {/*
                  Free: canvas + escudo anti “salvar como / abrir em guia”.
                  VIP locked: não carrega a URL real no DOM.
                  VIP liberado: img normal + botão Baixar oficial.
                */}
                <ProtectedMedia
                  src={post.imageUrl}
                  alt=""
                  protect={!canDownload || locked}
                  locked={locked}
                >
                  {canDownload && !locked ? (
                    <button
                      type="button"
                      onClick={onDownloadAttachment}
                      disabled={downloading}
                      className={cn(
                        "inline-flex h-9 items-center gap-1.5 rounded-full border border-white/20",
                        "bg-black/75 px-3 text-[11px] font-bold text-white shadow-md backdrop-blur-sm",
                        "transition hover:bg-black disabled:opacity-50"
                      )}
                      title="Baixar anexo (VIP)"
                      aria-label="Baixar anexo"
                    >
                      <DownloadSimple size={15} weight="bold" />
                      {downloading ? "Baixando…" : "Baixar"}
                    </button>
                  ) : !locked ? (
                    <Link
                      href="/pricing"
                      className={cn(
                        "inline-flex h-9 items-center gap-1.5 rounded-full border border-white/20",
                        "bg-black/70 px-3 text-[11px] font-bold text-white/90 shadow-md backdrop-blur-sm",
                        "transition hover:bg-black"
                      )}
                      title="Download exclusivo VIP"
                    >
                      <CrownSimple
                        size={13}
                        weight="fill"
                        className="text-amber-300"
                      />
                      VIP baixar
                    </Link>
                  ) : null}
                </ProtectedMedia>
              </div>
            )}

            {/* Música — depois da mídia (legenda / GIF / imagem / combos) */}
            {post.music && !locked && (
              <PostFeedMusic postId={post.id} music={post.music} />
            )}

            {post.location && (
              <p className="mt-2.5 inline-flex items-center gap-1 text-xs font-medium text-sky-600">
                <MapPin size={13} weight="fill" />
                {post.location}
              </p>
            )}

            {error && !openComments && (
              <p className="mt-2 text-xs font-medium text-red-600">{error}</p>
            )}

            {/* Ações: like · dislike · comentário · (espaço) · salvar por último */}
            <div className="mt-3 flex items-center gap-0.5 border-t border-neutral-100 pt-2.5 dark:border-zinc-800 sm:gap-1">
              <motion.button
                type="button"
                disabled={!user || locked}
                onClick={onLike}
                whileTap={
                  !user || locked || reduce ? undefined : { scale: 0.88 }
                }
                title="Curtir"
                aria-label={liked ? "Remover curtida" : "Curtir"}
                aria-pressed={liked}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-semibold sm:px-3",
                  "transition-colors duration-200",
                  liked
                    ? "bg-red-50 text-red-600 dark:bg-red-950/30"
                    : "text-neutral-400 hover:bg-neutral-50 hover:text-[#1f1f1f] dark:hover:bg-zinc-800",
                  (!user || locked) && "cursor-not-allowed opacity-50"
                )}
              >
                <span className={cn(pop && "like-pop", liked && "heart-fill")}>
                  <Heart
                    size={18}
                    weight={liked ? "fill" : "regular"}
                    className={liked ? "text-red-500" : undefined}
                  />
                </span>
                <span className="tabular-nums">{post.likes}</span>
              </motion.button>

              <motion.button
                type="button"
                disabled={!user || locked}
                onClick={onDislike}
                whileTap={
                  !user || locked || reduce ? undefined : { scale: 0.88 }
                }
                title="Não gostei"
                aria-label={disliked ? "Remover dislike" : "Não gostei"}
                aria-pressed={disliked}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-semibold sm:px-3",
                  "transition-colors duration-200",
                  disliked
                    ? "bg-neutral-100 text-[#1f1f1f] dark:bg-zinc-800 dark:text-zinc-100"
                    : "text-neutral-400 hover:bg-neutral-50 hover:text-[#1f1f1f] dark:hover:bg-zinc-800",
                  (!user || locked) && "cursor-not-allowed opacity-50"
                )}
              >
                <ThumbsDown
                  size={18}
                  weight={disliked ? "fill" : "regular"}
                  className={disliked ? "text-[#1f1f1f] dark:text-zinc-100" : undefined}
                />
                <span className="tabular-nums">{dislikes}</span>
              </motion.button>

              <button
                type="button"
                disabled={!user || locked}
                onClick={toggleComments}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-semibold transition-colors sm:px-3",
                  openComments
                    ? "bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400"
                    : "text-neutral-400 hover:bg-neutral-50 hover:text-[#1f1f1f] dark:hover:bg-zinc-800",
                  (!user || locked) && "cursor-not-allowed opacity-50"
                )}
                aria-expanded={openComments}
                aria-label={
                  openComments
                    ? "Fechar comentários"
                    : `Comentar · ${commentCount} comentários`
                }
              >
                <ChatCircle
                  size={18}
                  weight={openComments ? "fill" : "regular"}
                />
                <span className="tabular-nums">{commentCount}</span>
              </button>

              {/* Repost (estilo X) */}
              <motion.button
                type="button"
                disabled={
                  !user || locked || user.id === post.authorId
                }
                onClick={onRepost}
                whileTap={
                  !user || locked || reduce ? undefined : { scale: 0.88 }
                }
                title={
                  user?.id === post.authorId
                    ? "Não é possível repostar o próprio post"
                    : reposted
                      ? "Desfazer repost"
                      : "Repostar no seu perfil"
                }
                aria-label={reposted ? "Desfazer repost" : "Repostar"}
                aria-pressed={reposted}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-semibold sm:px-3",
                  "transition-colors duration-200",
                  reposted
                    ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400"
                    : "text-neutral-400 hover:bg-neutral-50 hover:text-[#1f1f1f] dark:hover:bg-zinc-800",
                  (!user || locked || user?.id === post.authorId) &&
                    "cursor-not-allowed opacity-50",
                  repostPop && "like-pop"
                )}
              >
                <Repeat
                  size={18}
                  weight={reposted ? "bold" : "regular"}
                  className={
                    reposted ? "text-emerald-600 dark:text-emerald-400" : undefined
                  }
                />
                {nReposts > 0 && (
                  <span className="tabular-nums">{nReposts}</span>
                )}
              </motion.button>

              {/* Encaminhar no bate-papo */}
              <button
                type="button"
                disabled={!user || locked}
                onClick={() => setForwardOpen(true)}
                title="Encaminhar no bate-papo"
                aria-label="Encaminhar post no bate-papo"
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-semibold transition-colors sm:px-3",
                  "text-neutral-400 hover:bg-neutral-50 hover:text-[#1f1f1f] dark:hover:bg-zinc-800",
                  (!user || locked) && "cursor-not-allowed opacity-50"
                )}
              >
                <ShareNetwork size={18} weight="regular" />
              </button>

              {/* Salvar — último, alinhado à direita */}
              <motion.button
                type="button"
                disabled={!user || locked}
                onClick={onSave}
                whileTap={
                  !user || locked || reduce ? undefined : { scale: 0.88 }
                }
                title={saved ? "Remover dos salvos" : "Salvar postagem"}
                aria-label={saved ? "Remover dos salvos" : "Salvar postagem"}
                aria-pressed={saved}
                className={cn(
                  "ml-auto inline-flex items-center justify-center rounded-full p-1.5 sm:px-3 sm:py-1.5",
                  "text-sm font-semibold transition-colors duration-200",
                  saved
                    ? "bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400"
                    : "text-neutral-400 hover:bg-neutral-50 hover:text-[#1f1f1f] dark:hover:bg-zinc-800",
                  (!user || locked) && "cursor-not-allowed opacity-50",
                  savePop && "like-pop"
                )}
              >
                <BookmarkSimple
                  size={20}
                  weight={saved ? "fill" : "regular"}
                  className={
                    saved ? "text-amber-500 dark:text-amber-400" : undefined
                  }
                />
                <span className="sr-only sm:not-sr-only sm:ml-1.5">
                  {saved ? "Salvo" : "Salvar"}
                </span>
              </motion.button>
            </div>

            {/* Comentários */}
            <AnimatePresence initial={false}>
              {openComments && !locked && (
                <motion.div
                  initial={reduce ? false : { opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={reduce ? undefined : { opacity: 0, height: 0 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 space-y-3 border-t border-neutral-100 pt-3 dark:border-zinc-800">
                    {rootComments.length === 0 && (
                      <p className="text-center text-xs text-neutral-400">
                        Nenhum comentário ainda. Seja o primeiro a responder.
                      </p>
                    )}

                    <ul className="space-y-3">
                      {rootComments.map((c) => {
                        const replies = repliesByParent.get(c.id) || [];
                        return (
                          <li key={c.id} className="space-y-2">
                            <CommentRow
                              comment={c}
                              users={users}
                              user={user}
                              isOwner={isOwner}
                              isReplyTarget={replyToId === c.id}
                              highlight={focusCommentId === c.id}
                              onReply={() => startReply(c.id, c.authorName)}
                              onDelete={() => onDeleteComment(c.id)}
                              onLike={() => {
                                if (!user) return;
                                void toggleCommentLike(c.id, user.id, user.name);
                              }}
                            />
                            {replies.length > 0 && (
                              <ul className="ml-8 space-y-2 border-l-2 border-neutral-100 pl-3 dark:border-zinc-800 sm:ml-10">
                                {replies.map((r) => (
                                  <li key={r.id}>
                                    <CommentRow
                                      comment={r}
                                      users={users}
                                      user={user}
                                      isOwner={isOwner}
                                      isReplyTarget={replyToId === r.id}
                                      highlight={focusCommentId === r.id}
                                      nested
                                      onReply={() =>
                                        startReply(r.id, r.authorName)
                                      }
                                      onDelete={() => onDeleteComment(r.id)}
                                      onLike={() => {
                                        if (!user) return;
                                        void toggleCommentLike(
                                          r.id,
                                          user.id,
                                          user.name
                                        );
                                      }}
                                    />
                                  </li>
                                ))}
                              </ul>
                            )}
                          </li>
                        );
                      })}
                    </ul>

                    {/* Form de comentar / responder */}
                    {user && (
                      <form
                        onSubmit={onSubmitComment}
                        className="flex items-start gap-2 pt-1"
                      >
                        <Avatar
                          name={user.name}
                          src={user.avatarUrl}
                          size="sm"
                        />
                        <div className="min-w-0 flex-1">
                          {replyToId && replyToName && (
                            <div className="mb-1.5 flex items-center justify-between gap-2 rounded-xl border border-sky-200 bg-sky-50 px-2.5 py-1.5 dark:border-sky-900 dark:bg-sky-950/40">
                              <p className="flex min-w-0 items-center gap-1.5 text-[12px] font-medium text-sky-800 dark:text-sky-300">
                                <ArrowBendUpLeft
                                  size={13}
                                  weight="bold"
                                  className="shrink-0"
                                />
                                <span className="truncate">
                                  Respondendo a{" "}
                                  <strong className="font-semibold">
                                    {replyToName}
                                  </strong>
                                </span>
                              </p>
                              <button
                                type="button"
                                onClick={cancelReply}
                                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sky-700 hover:bg-sky-100 dark:text-sky-300 dark:hover:bg-sky-900/50"
                                aria-label="Cancelar resposta"
                              >
                                <X size={12} weight="bold" />
                              </button>
                            </div>
                          )}
                          {gifPanelOpen && (
                            <div className="mb-2 rounded-2xl border border-neutral-200 bg-white p-2.5 dark:border-zinc-700 dark:bg-zinc-950">
                              <div className="mb-2 flex items-center gap-2">
                                <div className="relative min-w-0 flex-1">
                                  <MagnifyingGlass
                                    size={13}
                                    className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400"
                                  />
                                  <input
                                    value={gifQ}
                                    onChange={(e) => setGifQ(e.target.value)}
                                    placeholder="Buscar GIF…"
                                    className="h-8 w-full rounded-lg border border-neutral-200 bg-neutral-50 py-1.5 pl-8 pr-2 text-[12px] dark:border-zinc-700 dark:bg-zinc-900"
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setGifPanelOpen(false);
                                    setGifQ("");
                                  }}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 dark:hover:bg-zinc-800"
                                  aria-label="Fechar GIFs"
                                >
                                  <X size={14} weight="bold" />
                                </button>
                              </div>
                              {gifLoading ? (
                                <p className="flex items-center justify-center gap-2 py-6 text-[12px] text-neutral-400">
                                  <SpinnerGap
                                    size={14}
                                    className="animate-spin"
                                  />
                                  Buscando…
                                </p>
                              ) : (
                                <div className="grid max-h-40 grid-cols-4 gap-1.5 overflow-y-auto thin-scroll">
                                  {gifs.map((g) => (
                                    <button
                                      key={g.id}
                                      type="button"
                                      title={g.title}
                                      onClick={() => sendCommentGif(g)}
                                      className="relative aspect-square overflow-hidden rounded-lg bg-neutral-100 ring-1 ring-black/5 transition hover:ring-2 hover:ring-[#1f1f1f]/25 dark:bg-zinc-800"
                                    >
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src={g.previewUrl}
                                        alt=""
                                        className="h-full w-full object-cover"
                                        loading="lazy"
                                      />
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          <div
                            className={cn(
                              "flex items-end gap-1.5 rounded-2xl border bg-white px-2.5 py-2 dark:bg-zinc-950",
                              replyToId
                                ? "border-sky-300 dark:border-sky-800"
                                : "border-neutral-200 dark:border-zinc-700"
                            )}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setGifPanelOpen((v) => !v);
                                setError("");
                              }}
                              title="Comentar com GIF"
                              aria-label="Comentar com GIF"
                              aria-pressed={gifPanelOpen}
                              className={cn(
                                "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition",
                                gifPanelOpen
                                  ? "bg-[#1f1f1f] text-white dark:bg-white dark:text-black"
                                  : "text-neutral-400 hover:bg-neutral-100 hover:text-[#1f1f1f] dark:hover:bg-zinc-800"
                              )}
                            >
                              <Gif size={18} weight="regular" />
                            </button>
                            <textarea
                              ref={commentInputRef}
                              value={draft}
                              onChange={(e) => {
                                if (e.target.value.length <= MAX_COMMENT) {
                                  setDraft(e.target.value);
                                  setError("");
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                  e.preventDefault();
                                  onSubmitComment(e);
                                }
                                if (e.key === "Escape" && replyToId) {
                                  cancelReply();
                                }
                                if (e.key === "Escape" && gifPanelOpen) {
                                  setGifPanelOpen(false);
                                }
                              }}
                              placeholder={
                                replyToName
                                  ? `Responder ${replyToName.split(" ")[0]}…`
                                  : `Comentar no post de ${post.authorName.split(" ")[0]}…`
                              }
                              rows={1}
                              className="composer-input max-h-28 min-h-[36px] flex-1 resize-none border-0 bg-transparent py-1.5 text-sm text-[#0f1419] placeholder:text-neutral-400 outline-none focus:outline-none focus-visible:outline-none dark:text-zinc-100"
                            />
                            <button
                              type="submit"
                              disabled={!draft.trim()}
                              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0a0a0a] text-white transition hover:bg-black disabled:opacity-35 dark:bg-white dark:text-black"
                              aria-label={
                                replyToId
                                  ? "Enviar resposta"
                                  : "Enviar comentário"
                              }
                            >
                              <PaperPlaneTilt size={15} weight="fill" />
                            </button>
                          </div>
                          <div className="mt-1 flex items-center justify-between px-1">
                            {error ? (
                              <p className="text-[11px] font-medium text-red-600">
                                {error}
                              </p>
                            ) : (
                              <p className="text-[11px] text-neutral-400">
                                Enter envia · GIF pelo ícone
                                {replyToId ? " · Esc cancela" : ""}
                              </p>
                            )}
                            {draft.length > 0 && (
                              <span className="text-[11px] tabular-nums text-neutral-400">
                                {draft.length}/{MAX_COMMENT}
                              </span>
                            )}
                          </div>
                        </div>
                      </form>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {locked && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/60 p-4 backdrop-blur-[1px] dark:bg-black/50">
          <Link
            href="/pricing"
            className="pressable inline-flex items-center gap-2 rounded-full border border-[#1f1f1f]/20 bg-white px-4 py-2 text-sm font-bold text-[#1f1f1f] shadow-md"
          >
            <Lock size={14} weight="bold" />
            Conteúdo VIP
          </Link>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Apagar postagem?"
        description={
          isOwner
            ? "Os comentários também serão removidos. Esta ação não pode ser desfeita."
            : "Você está apagando como admin. Esta ação não pode ser desfeita."
        }
        confirmLabel="Apagar"
        cancelLabel="Cancelar"
        variant="danger"
        loading={deleting || trashing}
        onConfirm={confirmDeletePost}
        onCancel={() => {
          if (!deleting && !trashing) setConfirmDelete(false);
        }}
      />

      {user && canReport && (
        <ReportPostDialog
          open={reportOpen}
          postId={post.id}
          reporterId={user.id}
          reporterName={user.name}
          onClose={() => setReportOpen(false)}
        />
      )}

      <ForwardPostModal
        open={forwardOpen}
        onClose={() => setForwardOpen(false)}
        post={post}
      />
    </motion.article>
  );
}

function CommentRow({
  comment: c,
  users,
  user,
  isOwner,
  isReplyTarget,
  nested,
  highlight,
  onReply,
  onDelete,
  onLike,
}: {
  comment: {
    id: string;
    authorId: string;
    authorName: string;
    content: string;
    createdAt: string;
    likedBy?: string[];
    replyToName?: string | null;
    gifUrl?: string | null;
  };
  users: { id: string; avatarUrl?: string | null; isVip?: boolean; avatarFrame?: string | null; isVerified?: boolean }[];
  user: { id: string; role?: string } | null;
  isOwner: boolean;
  isReplyTarget?: boolean;
  nested?: boolean;
  highlight?: boolean;
  onReply: () => void;
  onDelete: () => void;
  onLike: () => void;
}) {
  const reduce = useReducedMotion();
  const cUser = users.find((u) => u.id === c.authorId);
  const canDeleteThisComment =
    !!user &&
    (user.id === c.authorId || isOwner || user.role === "admin");
  const likedBy = c.likedBy ?? [];
  const liked = !!user && likedBy.includes(user.id);
  const likeCount = likedBy.length;
  const [likePop, setLikePop] = useState(false);

  function handleLike() {
    if (!user) return;
    if (!liked) {
      setLikePop(true);
      window.setTimeout(() => setLikePop(false), 400);
    }
    onLike();
  }

  return (
    <div
      id={`comment-${c.id}`}
      className={cn(
        "group/comment flex scroll-mt-24 gap-2.5",
        (isReplyTarget || highlight) &&
          "rounded-xl ring-2 ring-sky-300/80 ring-offset-1 dark:ring-sky-700"
      )}
    >
      <ProfileHoverCard
        userId={c.authorId}
        fallback={{
          name: c.authorName,
          avatarUrl: cUser?.avatarUrl,
          isVerified: cUser?.isVerified,
          isVip: cUser?.isVip,
          avatarFrame: cUser?.avatarFrame as never,
        }}
      >
        <Link href={`/app/u/${c.authorId}`} className="avatar-link shrink-0">
          <Avatar
            name={c.authorName}
            src={cUser?.avatarUrl}
            size="sm"
            frame={cUser?.isVip ? (cUser.avatarFrame as never) : null}
          />
        </Link>
      </ProfileHoverCard>
      <div
        className={cn(
          "min-w-0 flex-1 rounded-2xl rounded-tl-md px-3 py-2",
          nested
            ? "bg-neutral-100/80 dark:bg-zinc-900/80"
            : "bg-neutral-50 dark:bg-zinc-900"
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <ProfileHoverCard
              userId={c.authorId}
              fallback={{
                name: c.authorName,
                avatarUrl: cUser?.avatarUrl,
                isVerified: cUser?.isVerified,
                isVip: cUser?.isVip,
                avatarFrame: cUser?.avatarFrame as never,
              }}
            >
              <Link
                href={`/app/u/${c.authorId}`}
                className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#1f1f1f] hover:underline dark:text-zinc-100"
              >
                {c.authorName}
                {cUser?.isVerified && <VerifiedBadge size={12} />}
              </Link>
            </ProfileHoverCard>
            <span className="text-[11px] text-neutral-400">
              {formatRelative(c.createdAt)}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <motion.button
              type="button"
              disabled={!user}
              onClick={handleLike}
              whileTap={!user || reduce ? undefined : { scale: 0.88 }}
              title={liked ? "Descurtir" : "Curtir comentário"}
              aria-label={
                liked
                  ? `Descurtir comentário · ${likeCount}`
                  : `Curtir comentário · ${likeCount}`
              }
              aria-pressed={liked}
              className={cn(
                "inline-flex h-7 items-center gap-1 rounded-full px-2 text-[11px] font-semibold transition",
                liked
                  ? "bg-red-50 text-red-500 opacity-100 dark:bg-red-950/40 dark:text-red-400"
                  : "text-neutral-400 opacity-80 hover:bg-red-50 hover:text-red-500 group-hover/comment:opacity-100 dark:hover:bg-red-950/30",
                !user && "cursor-not-allowed opacity-50"
              )}
            >
              <motion.span
                animate={
                  likePop && !reduce
                    ? { scale: [1, 1.35, 1] }
                    : { scale: 1 }
                }
                transition={{ duration: 0.35 }}
                className="inline-flex"
              >
                <Heart
                  size={13}
                  weight={liked ? "fill" : "regular"}
                  className={liked ? "text-red-500" : undefined}
                />
              </motion.span>
              {likeCount > 0 && (
                <span className="tabular-nums">{likeCount}</span>
              )}
            </motion.button>
            {user && (
              <button
                type="button"
                onClick={onReply}
                title="Responder"
                aria-label={`Responder ${c.authorName}`}
                className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-[11px] font-semibold text-neutral-400 opacity-80 transition hover:bg-sky-50 hover:text-sky-600 group-hover/comment:opacity-100 dark:hover:bg-sky-950/40"
              >
                <ArrowBendUpLeft size={13} weight="bold" />
                <span className="hidden sm:inline">Responder</span>
              </button>
            )}
            {canDeleteThisComment && (
              <button
                type="button"
                onClick={onDelete}
                title={
                  isOwner && user?.id !== c.authorId
                    ? "Apagar comentário do seu post"
                    : "Apagar seu comentário"
                }
                aria-label="Apagar comentário"
                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-neutral-400 opacity-70 transition hover:bg-red-50 hover:text-red-600 group-hover/comment:opacity-100 dark:hover:bg-red-950/40"
              >
                <Trash size={14} weight="bold" />
              </button>
            )}
          </div>
        </div>
        {c.replyToName && (
          <p className="mt-0.5 text-[11px] font-medium text-sky-600/90 dark:text-sky-400">
            ↳ respondendo {c.replyToName}
          </p>
        )}
        {c.gifUrl ? (
          <LazyGif
            src={c.gifUrl}
            alt="GIF"
            className="mt-1.5 max-w-full rounded-xl ring-1 ring-black/5 dark:ring-white/10"
            maxHeightClass="max-h-52"
          />
        ) : null}
        {c.content?.trim() ? (
          <p className="mt-0.5 text-[13px] leading-relaxed text-neutral-700 dark:text-zinc-300">
            <RichText text={c.content} emojiSize={18} />
          </p>
        ) : null}
      </div>
    </div>
  );
}
