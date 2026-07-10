"use client";

import { ConfirmDialog } from "@/components/confirm-dialog";
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
import { consumeRateLimit } from "@/lib/rate-limit";
import type { Post } from "@/lib/types";
import { cn, formatRelative } from "@/lib/utils";
import {
  BookmarkSimple,
  ChatCircle,
  CrownSimple,
  DotsThree,
  DownloadSimple,
  Flag,
  Heart,
  Lock,
  MapPin,
  PaperPlaneTilt,
  ThumbsDown,
  Trash,
} from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

const MAX_COMMENT = 400;

export function PostCard({ post }: { post: Post }) {
  const { user, isVip } = useAuth();
  const toggleLike = useForumStore((s) => s.toggleLike);
  const toggleDislike = useForumStore((s) => s.toggleDislike);
  const toggleSave = useForumStore((s) => s.toggleSave);
  const deletePost = useForumStore((s) => s.deletePost);
  const addComment = useForumStore((s) => s.addComment);
  const allComments = useForumStore((s) => s.comments);
  const users = useAuthStore((s) => s.users);

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
  const [error, setError] = useState("");
  const [savePop, setSavePop] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [trashing, setTrashing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

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

  // Contador real do store (não depende só do número seed no post)
  const commentCount = Math.max(post.comments, postComments.length);

  function onLike() {
    if (!user || locked) return;
    if (!liked) {
      setPop(true);
      window.setTimeout(() => setPop(false), 450);
    }
    toggleLike(post.id, user.id);
  }

  function onDislike() {
    if (!user || locked) return;
    toggleDislike(post.id, user.id);
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
    // animação “joga na lixeira”, depois remove do store
    setTrashing(true);
    const delay = reduce ? 80 : 520;
    window.setTimeout(() => {
      const res = deletePost(post.id, user.id, { isAdmin });
      if (!res.ok) {
        setError(res.error);
        setDeleting(false);
        setTrashing(false);
      }
    }, delay);
  }

  function toggleComments() {
    if (locked) return;
    setOpenComments((v) => !v);
    setError("");
  }

  function onSubmitComment(e: FormEvent) {
    e.preventDefault();
    if (!user || locked) return;
    const text = draft.trim();
    if (!text) {
      setError("Escreva um comentário.");
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
    addComment({
      postId: post.id,
      authorId: user.id,
      authorName: user.name,
      authorAvatar: user.avatar,
      content: text,
    });
    setDraft("");
    setError("");
    setOpenComments(true);
  }

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
      style={{ transformOrigin: "top right" }}
      className={cn(
        "card-interactive rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-elevated)] p-4",
        locked && "relative overflow-hidden",
        trashing && "pointer-events-none z-10"
      )}
    >
      <div
        className={cn(
          "flex flex-col gap-2",
          locked && "pointer-events-none select-none blur-[3px] opacity-40"
        )}
      >
        <div className="flex items-start gap-3">
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
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                <Link
                  href={`/app/u/${post.authorId}`}
                  className="inline-flex items-center text-[15px] font-medium text-[var(--text-primary)] transition-colors hover:opacity-70"
                >
                  {post.authorName}
                  {author?.isVerified && <VerifiedBadge size={14} />}
                </Link>
                {post.vipOnly && <VipBadge />}
                <span className="text-[13px] text-[var(--text-tertiary)] tabular-nums">
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
                      "inline-flex h-10 w-10 items-center justify-center rounded-full",
                      "text-[var(--text-tertiary)] transition-[background-color,color] duration-[var(--duration-fast)]",
                      "hover:bg-neutral-100 hover:text-[var(--text-primary)]",
                      "dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
                      menuOpen &&
                        "bg-neutral-100 text-[var(--text-primary)] dark:bg-zinc-800",
                      (deleting || trashing) && "pointer-events-none opacity-40"
                    )}
                    aria-label="Opções do post"
                    aria-expanded={menuOpen}
                    aria-haspopup="menu"
                    title="Opções"
                  >
                    <DotsThree size={20} weight="bold" aria-hidden />
                  </button>

                  <AnimatePresence>
                    {menuOpen && (
                      <motion.div
                        initial={
                          reduce
                            ? false
                            : { opacity: 0, y: 4, scale: 0.98 }
                        }
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={
                          reduce
                            ? undefined
                            : { opacity: 0, y: 2, scale: 0.98 }
                        }
                        transition={{
                          duration: reduce ? 0 : 0.2,
                          ease: [0.16, 1, 0.3, 1],
                        }}
                        role="menu"
                        style={{ transformOrigin: "top right" }}
                        className={cn(
                          "popover-panel absolute right-0 top-full z-20 mt-1 min-w-[10.5rem] overflow-hidden py-1"
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
              <h3 className="mt-1 line-clamp-2 text-[15px] font-medium tracking-tight text-[var(--text-primary)]">
                {post.title}
              </h3>
            )}

            {body && body !== " " && (
              <p
                className={cn(
                  "text-[15px] leading-[1.5] text-[var(--text-primary)]",
                  hasTitle ? "mt-1" : "mt-0.5"
                )}
              >
                <RichText text={body} emojiSize={20} />
              </p>
            )}

            {post.imageUrl && (
              <div className="relative mt-2 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={post.imageUrl}
                  alt=""
                  loading="lazy"
                  className="max-h-[min(480px,70vh)] w-full object-contain object-center"
                />
                {/* Download de anexo — VIP */}
                <div className="absolute bottom-2 right-2 z-10">
                  {canDownload ? (
                    <button
                      type="button"
                      onClick={onDownloadAttachment}
                      disabled={downloading || locked}
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
                  ) : (
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
                  )}
                </div>
              </div>
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

            {/* Ações: like · dislike · comentário · salvar — touch 40×40, gap 6px */}
            <div className="mt-2 flex items-center gap-0.5 border-t border-[var(--border)] pt-2">
              <motion.button
                type="button"
                disabled={!user || locked}
                onClick={onLike}
                whileTap={
                  !user || locked || reduce ? undefined : { scale: 0.96 }
                }
                title="Curtir"
                aria-label={liked ? "Remover curtida" : "Curtir"}
                aria-pressed={liked}
                className={cn(
                  "post-action px-2.5",
                  liked && "bg-red-50 text-red-600 dark:bg-red-950/30",
                  (!user || locked) && "cursor-not-allowed opacity-50"
                )}
              >
                <span className={cn(pop && "like-pop", liked && "heart-fill")}>
                  <Heart
                    size={18}
                    weight={liked ? "fill" : "regular"}
                    className={liked ? "text-red-500" : undefined}
                    aria-hidden
                  />
                </span>
                <span
                  key={`likes-${post.likes}`}
                  className={cn("tabular-nums", pop && "count-slide-in")}
                >
                  {post.likes}
                </span>
              </motion.button>

              <motion.button
                type="button"
                disabled={!user || locked}
                onClick={onDislike}
                whileTap={
                  !user || locked || reduce ? undefined : { scale: 0.96 }
                }
                title="Não gostei"
                aria-label={disliked ? "Remover dislike" : "Não gostei"}
                aria-pressed={disliked}
                className={cn(
                  "post-action px-2.5",
                  disliked &&
                    "bg-neutral-100 text-[var(--text-primary)] dark:bg-zinc-800",
                  (!user || locked) && "cursor-not-allowed opacity-50"
                )}
              >
                <ThumbsDown
                  size={18}
                  weight={disliked ? "fill" : "regular"}
                  aria-hidden
                />
                <span className="tabular-nums">{dislikes}</span>
              </motion.button>

              <button
                type="button"
                disabled={!user || locked}
                onClick={toggleComments}
                className={cn(
                  "post-action px-2.5",
                  openComments &&
                    "bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400",
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
                  aria-hidden
                />
                <span className="tabular-nums">{commentCount}</span>
              </button>

              <motion.button
                type="button"
                disabled={!user || locked}
                onClick={onSave}
                whileTap={
                  !user || locked || reduce ? undefined : { scale: 0.96 }
                }
                title={saved ? "Remover dos salvos" : "Salvar postagem"}
                aria-label={saved ? "Remover dos salvos" : "Salvar postagem"}
                aria-pressed={saved}
                className={cn(
                  "post-action ml-auto px-2.5",
                  saved &&
                    "bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400",
                  (!user || locked) && "cursor-not-allowed opacity-50",
                  savePop && "like-pop"
                )}
              >
                <BookmarkSimple
                  size={18}
                  weight={saved ? "fill" : "regular"}
                  className={
                    saved ? "text-amber-500 dark:text-amber-400" : undefined
                  }
                  aria-hidden
                />
                <span className="sr-only sm:not-sr-only">
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
                    {postComments.length === 0 && (
                      <p className="text-center text-xs text-neutral-400">
                        Nenhum comentário ainda. Seja o primeiro a responder.
                      </p>
                    )}

                    <ul className="space-y-3">
                      {postComments.map((c) => {
                        const cUser = users.find((u) => u.id === c.authorId);
                        return (
                          <li key={c.id} className="flex gap-2.5">
                            <Link
                              href={`/app/u/${c.authorId}`}
                              className="avatar-link shrink-0"
                            >
                              <Avatar
                                name={c.authorName}
                                src={cUser?.avatarUrl}
                                size="sm"
                                frame={
                                  cUser?.isVip ? cUser.avatarFrame : null
                                }
                              />
                            </Link>
                            <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md bg-neutral-50 px-3 py-2 dark:bg-zinc-900">
                              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                <Link
                                  href={`/app/u/${c.authorId}`}
                                  className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#1f1f1f] hover:underline dark:text-zinc-100"
                                >
                                  {c.authorName}
                                  {cUser?.isVerified && (
                                    <VerifiedBadge size={12} />
                                  )}
                                </Link>
                                <span className="text-[11px] text-neutral-400">
                                  {formatRelative(c.createdAt)}
                                </span>
                              </div>
                              <p className="mt-0.5 text-[13px] leading-relaxed text-neutral-700 dark:text-zinc-300">
                                <RichText text={c.content} emojiSize={18} />
                              </p>
                            </div>
                          </li>
                        );
                      })}
                    </ul>

                    {/* Form de comentar — qualquer usuário logado em qualquer post */}
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
                          <div className="flex items-end gap-2 rounded-2xl border border-neutral-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950">
                            <textarea
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
                              }}
                              placeholder={`Comentar no post de ${post.authorName.split(" ")[0]}…`}
                              rows={1}
                              className="composer-input max-h-28 min-h-[36px] flex-1 resize-none border-0 bg-transparent py-1.5 text-sm text-[#0f1419] placeholder:text-neutral-400 outline-none focus:outline-none focus-visible:outline-none dark:text-zinc-100"
                            />
                            <button
                              type="submit"
                              disabled={!draft.trim()}
                              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0a0a0a] text-white transition hover:bg-black disabled:opacity-35 dark:bg-white dark:text-black"
                              aria-label="Enviar comentário"
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
                                Enter para enviar · Shift+Enter para nova linha
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
    </motion.article>
  );
}
