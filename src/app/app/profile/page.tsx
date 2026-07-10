"use client";

import { EmblemPicker } from "@/components/emblem-picker";
import { EmojiPicker } from "@/components/emoji-picker";
import {
  BannerImage,
  GifBannerEditor,
} from "@/components/gif-banner-editor";
import {
  ImageCropEditor,
  type CropKind,
} from "@/components/image-crop-editor";
import {
  MusicPlatformIcon,
  musicPlatformLabel,
} from "@/components/music-platform-icon";
import { ProfileEmblem } from "@/components/profile-emblem";
import { ProfileLinkIcon } from "@/components/profile-link-icon";
import { RichText } from "@/components/rich-text";
import { TagChips } from "@/components/tag-chips";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { VerifiedBadge } from "@/components/verified-badge";
import { useAuth } from "@/hooks/use-auth";
import { useAuthStore } from "@/lib/auth-store";
import {
  GOAL_PLACEHOLDER,
  INTEREST_OPTIONS,
  MAX_GOALS,
  maxProfileLinks,
} from "@/lib/catalog";
import {
  computeBadgeStats,
  evaluateEmblems,
  type EmblemId,
} from "@/lib/emblems";
import { useForumStore } from "@/lib/forum-store";
import {
  fileToDataUrl,
  fileToObjectUrl,
  isGifDataUrl,
  isGifFile,
  revokeObjectUrl,
  validateBannerFile,
  validateImageFile,
} from "@/lib/image";
import { useSocialStore } from "@/lib/social-store";
import {
  detectMusicPlatform,
  fetchMusicMeta,
  isValidMusicUrl,
  maxFavoriteTracks,
  MUSIC_PLATFORM_META,
  type FavoriteTrack,
  type MusicPlatform,
} from "@/lib/music";
import type { BannerFit, ProfileLink } from "@/lib/types";
import { DEFAULT_BANNER_FIT } from "@/lib/types";
import { cn, formatDate, isValidUrl, normalizeUrl, uid } from "@/lib/utils";
import {
  Camera,
  CheckCircle,
  Crop as CropIcon,
  CrownSimple,
  FloppyDisk,
  Headphones,
  Image as ImageIcon,
  Plus,
  SealCheck,
  Smiley,
  Trash,
  UserCircle,
  X,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

export default function ProfilePage() {
  const { user } = useAuth();
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const deleteAccount = useAuthStore((s) => s.deleteAccount);
  const logout = useAuthStore((s) => s.logout);
  const posts = useForumStore((s) => s.posts);
  const follows = useSocialStore((s) => s.follows);
  const followerCount = useSocialStore((s) => s.followerCount);
  const followingCount = useSocialStore((s) => s.followingCount);
  const router = useRouter();
  void follows;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [bio, setBio] = useState("");
  const [password, setPassword] = useState("");
  /** Só envia senha ao Supabase quando o usuário abre “Alterar senha” de propósito */
  const [changePassword, setChangePassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [bannerFit, setBannerFit] = useState<BannerFit | null>(null);
  const [gifEditorOpen, setGifEditorOpen] = useState(false);
  const [gifEditorSrc, setGifEditorSrc] = useState<string | null>(null);
  const [interests, setInterests] = useState<string[]>([]);
  const [goals, setGoals] = useState<string[]>([]);
  const [customGoal, setCustomGoal] = useState("");
  const [seekingMentorship, setSeekingMentorship] = useState(false);
  const [offeringMentorship, setOfferingMentorship] = useState(false);
  const [mentorTopics, setMentorTopics] = useState<string[]>([]);
  const [customMentorTopic, setCustomMentorTopic] = useState("");
  const [links, setLinks] = useState<ProfileLink[]>([]);
  const [badgesUnlocked, setBadgesUnlocked] = useState<EmblemId[]>([]);
  const [badgeEquipped, setBadgeEquipped] = useState<EmblemId | null>(null);
  const [linkLabel, setLinkLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [tracks, setTracks] = useState<FavoriteTrack[]>([]);
  const [trackTitle, setTrackTitle] = useState("");
  const [trackUrl, setTrackUrl] = useState("");
  const [trackPlatform, setTrackPlatform] =
    useState<MusicPlatform | "auto">("auto");
  const [trackLoading, setTrackLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Editor de crop
  const [cropOpen, setCropOpen] = useState(false);
  const [cropKind, setCropKind] = useState<CropKind>("avatar");
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const bioRef = useRef<HTMLTextAreaElement>(null);
  const bioEmojiBtnRef = useRef<HTMLButtonElement>(null);
  const bioEmojiPanelRef = useRef<HTMLDivElement>(null);
  const [showBioEmoji, setShowBioEmoji] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
      setBio(user.bio || "");
      setAvatarUrl(user.avatarUrl ?? null);
      setBannerUrl(user.bannerUrl ?? null);
      setBannerFit(user.bannerFit ?? null);
      setInterests(user.interests ?? []);
      setGoals(user.goals ?? []);
      setSeekingMentorship(user.seekingMentorship ?? false);
      setOfferingMentorship(user.offeringMentorship ?? false);
      setMentorTopics(user.mentorTopics ?? []);
      setLinks(user.links ?? []);
      setTracks(user.isVip ? user.favoriteTracks ?? [] : []);
      setBadgesUnlocked(user.badgesUnlocked ?? []);
      setBadgeEquipped(user.badgeEquipped ?? null);
    }
  }, [user]);

  // Avalia conquistas (VIP, tempo, engajamento…) e grava se mudou
  useEffect(() => {
    if (!user) return;
    const stats = computeBadgeStats(user.id, posts);
    const unlocked = evaluateEmblems(user, stats);
    const prev = new Set(user.badgesUnlocked ?? []);
    const changed =
      unlocked.length !== prev.size || unlocked.some((id) => !prev.has(id));
    if (!changed) {
      setBadgesUnlocked(user.badgesUnlocked ?? []);
      return;
    }
    setBadgesUnlocked(unlocked);
    // equipado inválido? limpa
    const eq =
      user.badgeEquipped && unlocked.includes(user.badgeEquipped)
        ? user.badgeEquipped
        : null;
    setBadgeEquipped(eq);
    void updateProfile({
      badgesUnlocked: unlocked,
      badgeEquipped: eq,
    });
  }, [user?.id, user?.role, user?.isVip, user?.createdAt, posts, updateProfile, user]);

  useEffect(() => {
    return () => {
      revokeObjectUrl(cropSrc);
    };
  }, [cropSrc]);

  // Fecha picker de emoji da bio ao clicar fora
  useEffect(() => {
    if (!showBioEmoji) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (
        bioEmojiPanelRef.current?.contains(t) ||
        bioEmojiBtnRef.current?.contains(t)
      ) {
        return;
      }
      setShowBioEmoji(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [showBioEmoji]);

  function insertIntoBio(chunk: string) {
    const el = bioRef.current;
    if (!el) {
      setBio((b) => b + chunk);
      return;
    }
    const start = el.selectionStart ?? bio.length;
    const end = el.selectionEnd ?? bio.length;
    const next = bio.slice(0, start) + chunk + bio.slice(end);
    setBio(next);
    requestAnimationFrame(() => {
      el.focus({ preventScroll: true });
      const pos = start + chunk.length;
      el.setSelectionRange(pos, pos);
    });
  }

  function clearFileInput(kind: CropKind) {
    if (kind === "avatar" && avatarInputRef.current) {
      avatarInputRef.current.value = "";
    }
    if (kind === "banner" && bannerInputRef.current) {
      bannerInputRef.current.value = "";
    }
  }

  function openCropEditor(file: File | undefined, kind: CropKind) {
    if (!file) return;
    const check = validateImageFile(file);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    setError("");
    revokeObjectUrl(cropSrc);
    const url = fileToObjectUrl(file);
    setCropSrc(url);
    setCropKind(kind);
    setCropOpen(true);
    clearFileInput(kind);
  }

  /**
   * Banner:
   * - GIF + VIP → salva animado sem crop (canvas mataria a animação)
   * - estático → editor de recorte 3:1
   * - GIF + free → bloqueado
   */
  async function onBannerFile(file: File | undefined) {
    if (!file) return;
    const isVip = !!user?.isVip;
    const check = validateBannerFile(file, isVip);
    if (!check.ok) {
      setError(check.error);
      clearFileInput("banner");
      return;
    }
    setError("");

    if (isGifFile(file)) {
      try {
        const dataUrl = await fileToDataUrl(file);
        setBannerUrl(dataUrl);
        setBannerFit(DEFAULT_BANNER_FIT);
        setGifEditorSrc(dataUrl);
        setGifEditorOpen(true);
        setMessage("");
      } catch {
        setError("Não foi possível carregar o GIF.");
      }
      clearFileInput("banner");
      return;
    }

    // banner estático: fit default + crop clássico
    setBannerFit(null);
    openCropEditor(file, "banner");
  }

  function closeCropEditor() {
    setCropOpen(false);
    revokeObjectUrl(cropSrc);
    setCropSrc(null);
  }

  function onCropConfirm(dataUrl: string) {
    if (cropKind === "avatar") setAvatarUrl(dataUrl);
    else {
      setBannerUrl(dataUrl);
      setBannerFit(null);
    }
    closeCropEditor();
    setMessage(
      cropKind === "avatar"
        ? "Foto ajustada. Clique em Salvar para confirmar."
        : "Banner ajustado. Clique em Salvar para confirmar."
    );
  }

  function openGifPositionEditor() {
    if (!bannerUrl || !isGifDataUrl(bannerUrl)) return;
    setGifEditorSrc(bannerUrl);
    setGifEditorOpen(true);
  }

  function onGifFitConfirm(fit: BannerFit) {
    setBannerFit(fit);
    setGifEditorOpen(false);
    setGifEditorSrc(null);
    setMessage("Posição do GIF aplicada. Clique em Salvar para confirmar.");
  }

  function onGifFitCancel() {
    setGifEditorOpen(false);
    setGifEditorSrc(null);
  }

  function toggleInterest(tag: string) {
    setInterests((prev) =>
      prev.some((t) => t.toLowerCase() === tag.toLowerCase())
        ? prev.filter((t) => t.toLowerCase() !== tag.toLowerCase())
        : [...prev, tag]
    );
  }

  function toggleMentorTopic(tag: string) {
    setMentorTopics((prev) =>
      prev.some((t) => t.toLowerCase() === tag.toLowerCase())
        ? prev.filter((t) => t.toLowerCase() !== tag.toLowerCase())
        : [...prev, tag]
    );
  }

  function addGoal(goal: string) {
    const g = goal.trim();
    if (!g) return;
    if (goals.length >= MAX_GOALS) {
      setError(`Você pode ter no máximo ${MAX_GOALS} objetivos.`);
      return;
    }
    if (goals.some((x) => x.toLowerCase() === g.toLowerCase())) return;
    setError("");
    setGoals((prev) => [...prev, g]);
    setCustomGoal("");
  }

  function addMentorTopic(topic: string) {
    const t = topic.trim();
    if (!t) return;
    if (mentorTopics.some((x) => x.toLowerCase() === t.toLowerCase())) {
      setCustomMentorTopic("");
      return;
    }
    setMentorTopics((prev) => [...prev, t]);
    setCustomMentorTopic("");
  }

  const linkLimit = maxProfileLinks(!!user?.isVip);
  const trackLimit = maxFavoriteTracks(!!user?.isVip);

  function addLink() {
    const url = linkUrl.trim();
    if (!url) {
      setError("Informe a URL do link.");
      return;
    }
    if (!isValidUrl(url)) {
      setError("URL inválida. Use algo como https://seu-site.com");
      return;
    }
    if (links.length >= linkLimit) {
      setError(
        user?.isVip
          ? `VIP pode adicionar até ${linkLimit} links.`
          : `No plano free você tem 1 link. Assine o VIP para até 6.`
      );
      return;
    }
    setError("");
    setLinks((prev) => [
      ...prev,
      {
        id: uid("link"),
        label: linkLabel.trim(),
        url: normalizeUrl(url),
      },
    ]);
    setLinkLabel("");
    setLinkUrl("");
  }

  async function addTrack() {
    if (!user?.isVip) {
      setError("Músicas favoritas são exclusivas do Plano VIP.");
      return;
    }
    const url = trackUrl.trim();
    if (!url) {
      setError("Cole o link da música (Spotify, YouTube ou SoundCloud).");
      return;
    }
    if (!isValidUrl(url) || !isValidMusicUrl(url)) {
      setError(
        "URL inválida. Use um link do Spotify, YouTube ou SoundCloud."
      );
      return;
    }
    if (tracks.length >= trackLimit) {
      setError(`VIP pode adicionar até ${trackLimit} músicas.`);
      return;
    }
    const detected = detectMusicPlatform(url);
    if (!detected) {
      setError("Plataforma não reconhecida.");
      return;
    }
    const platform =
      trackPlatform === "auto" ? detected : trackPlatform;
    if (platform !== detected) {
      setError(
        `Esse link é do ${MUSIC_PLATFORM_META[detected].label}. Ajuste a plataforma ou a URL.`
      );
      return;
    }

    setError("");
    setTrackLoading(true);
    const meta = await fetchMusicMeta(url);
    setTrackLoading(false);

    if (!meta.ok) {
      setError(meta.error);
      return;
    }

    const manualTitle = trackTitle.trim();
    setTracks((prev) => [
      ...prev,
      {
        id: uid("trk"),
        title: manualTitle || meta.data.title,
        artist: meta.data.artist,
        url: meta.data.canonicalUrl || normalizeUrl(url),
        platform: meta.data.platform,
        thumbnailUrl: meta.data.thumbnailUrl,
        embedUrl: meta.data.embedUrl,
      },
    ]);
    setTrackTitle("");
    setTrackUrl("");
    setTrackPlatform("auto");
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    if (links.length > linkLimit) {
      setError(
        user?.isVip
          ? `Remova links extras (máx. ${linkLimit} no VIP).`
          : `Plano free: máximo 1 link. Remova os extras ou assine o VIP.`
      );
      return;
    }
    if (user?.isVip && tracks.length > trackLimit) {
      setError(`Máximo de ${trackLimit} músicas no VIP.`);
      return;
    }
    // Senha só quando o usuário abriu o bloco e digitou uma nova
    const wantsPasswordChange =
      changePassword && password.trim().length > 0;
    if (wantsPasswordChange && password.trim().length < 6) {
      setError("A nova senha precisa ter no mínimo 6 caracteres.");
      return;
    }
    setSaving(true);
    try {
      const result = await updateProfile({
        name,
        email,
        bio,
        // Nunca manda senha no save normal — autofill do browser quebrava o upload
        ...(wantsPasswordChange ? { password: password.trim() } : {}),
        avatarUrl,
        bannerUrl,
        bannerFit:
          bannerUrl && isGifDataUrl(bannerUrl)
            ? bannerFit ?? DEFAULT_BANNER_FIT
            : null,
        avatarFrame: null,
        interests,
        goals,
        seekingMentorship,
        offeringMentorship,
        mentorTopics: offeringMentorship ? mentorTopics : [],
        links: links.slice(0, linkLimit),
        favoriteTracks: user?.isVip ? tracks.slice(0, trackLimit) : [],
        badgesUnlocked,
        badgeEquipped,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPassword("");
      setChangePassword(false);
      // sincroniza preview com URLs remotas (Supabase Storage)
      if (result.user) {
        setAvatarUrl(result.user.avatarUrl ?? null);
        setBannerUrl(result.user.bannerUrl ?? null);
        setBannerFit(result.user.bannerFit ?? null);
      }
      setMessage("Perfil atualizado com sucesso.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Falha ao salvar. Tente de novo."
      );
    } finally {
      setSaving(false);
    }
  }

  function onDelete() {
    if (
      !confirm(
        "Tem certeza que deseja excluir sua conta? Esta ação não pode ser desfeita no MVP."
      )
    ) {
      return;
    }
    const result = deleteAccount();
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push("/");
  }

  const hasUnsavedChanges = useMemo(() => {
    if (!user) return false;
    if (changePassword && password.length > 0) return true;
    if (name.trim() !== user.name) return true;
    if (email.trim().toLowerCase() !== user.email) return true;
    if ((bio || "") !== (user.bio || "")) return true;
    if ((avatarUrl || null) !== (user.avatarUrl || null)) return true;
    if ((bannerUrl || null) !== (user.bannerUrl || null)) return true;
    if (
      JSON.stringify(bannerFit) !== JSON.stringify(user.bannerFit ?? null)
    )
      return true;
    if (seekingMentorship !== !!user.seekingMentorship) return true;
    if (offeringMentorship !== !!user.offeringMentorship) return true;
    if (JSON.stringify(interests) !== JSON.stringify(user.interests ?? []))
      return true;
    if (JSON.stringify(goals) !== JSON.stringify(user.goals ?? [])) return true;
    if (
      JSON.stringify(mentorTopics) !==
      JSON.stringify(user.mentorTopics ?? [])
    )
      return true;
    if (JSON.stringify(links) !== JSON.stringify(user.links ?? [])) return true;
    if (
      JSON.stringify(tracks) !== JSON.stringify(user.favoriteTracks ?? [])
    )
      return true;
    if ((badgeEquipped || null) !== (user.badgeEquipped || null)) return true;
    return false;
  }, [
    user,
    changePassword,
    password,
    name,
    email,
    bio,
    avatarUrl,
    bannerUrl,
    badgeEquipped,
    bannerFit,
    seekingMentorship,
    offeringMentorship,
    interests,
    goals,
    mentorTopics,
    links,
    tracks,
  ]);

  // Esconde o toast de sucesso após salvar
  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(() => setMessage(""), 3200);
    return () => window.clearTimeout(t);
  }, [message]);

  if (!user) return null;

  const showStickySave = hasUnsavedChanges || !!message || !!error || saving;

  return (
    <div
      className={cn(
        "app-page mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10",
        showStickySave && "pt-12"
      )}
    >
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[#1f1f1f]">
            Perfil
          </h1>
          <p className="mt-2 text-base text-neutral-600">
            Personalize banner, foto e dados da conta.
          </p>
        </div>
        <Link href={`/app/u/${user.id}`}>
          <Button variant="outline" type="button">
            <UserCircle size={18} weight="bold" />
            Ver perfil público
          </Button>
        </Link>
      </div>

      {/* Preview */}
      <div className="mb-6 rounded-2xl border border-neutral-200/90 bg-white shadow-[0_1px_3px_rgb(0_0_0/0.04),0_8px_24px_-12px_rgb(0_0_0/0.08)]">
        <div className="relative h-36 overflow-hidden rounded-t-2xl bg-neutral-200 sm:h-44">
          {bannerUrl ? (
            <BannerImage src={bannerUrl} fit={bannerFit} />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-neutral-200 via-neutral-100 to-neutral-300">
              <span className="text-xs font-medium text-neutral-500">
                Sem banner
              </span>
            </div>
          )}
          {bannerUrl && isGifDataUrl(bannerUrl) && (
            <span className="absolute left-3 top-3 z-20 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
              <CrownSimple size={10} weight="fill" className="text-amber-300" />
              GIF · VIP
            </span>
          )}
          <button
            type="button"
            onClick={() => bannerInputRef.current?.click()}
            className="absolute right-3 top-3 z-20 inline-flex items-center gap-1.5 rounded-full bg-[#1f1f1f]/90 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm transition hover:bg-[#1f1f1f]"
            title={
              user.isVip
                ? "Banner estático ou GIF animado (VIP)"
                : "Banner estático · GIF só no VIP"
            }
          >
            <ImageIcon size={14} weight="bold" />
            Banner
            {user.isVip && (
              <span className="rounded bg-white/15 px-1 text-[9px] font-bold uppercase tracking-wide text-amber-200">
                GIF
              </span>
            )}
          </button>
          <input
            ref={bannerInputRef}
            type="file"
            accept={
              user.isVip
                ? "image/jpeg,image/png,image/webp,image/gif,.gif"
                : "image/jpeg,image/png,image/webp"
            }
            className="hidden"
            onChange={(e) => onBannerFile(e.target.files?.[0])}
          />
        </div>

        <div className="relative px-5 pb-5 sm:px-6">
          <div className="relative flex h-12 items-start justify-end sm:h-14">
            <div className="absolute -top-14 left-0 z-10 sm:-top-16">
              <div className="relative">
                <Avatar
                  name={user.name}
                  src={avatarUrl}
                  size="2xl"
                />
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="absolute bottom-1 right-1 z-[2] inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[#1f1f1f] text-white shadow-md transition hover:bg-[#333]"
                  aria-label="Trocar foto"
                >
                  <Camera size={14} weight="bold" />
                </button>
              </div>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/*"
                className="hidden"
                onChange={(e) =>
                  openCropEditor(e.target.files?.[0], "avatar")
                }
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              {bannerUrl && isGifDataUrl(bannerUrl) && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={openGifPositionEditor}
                >
                  <CropIcon size={14} weight="bold" />
                  Posicionar GIF
                </Button>
              )}
              {bannerUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setBannerUrl(null);
                    setBannerFit(null);
                  }}
                >
                  Remover banner
                </Button>
              )}
              {avatarUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setAvatarUrl(null)}
                >
                  Remover foto
                </Button>
              )}
            </div>
          </div>

          <div className="mt-2 sm:mt-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="inline-flex items-center gap-1.5 text-[1.375rem] font-semibold tracking-tight text-[#1f1f1f]">
                {user.name}
                {user.isVerified && <VerifiedBadge size={18} />}
              </p>
              {user.isVip ? (
                <Badge variant="vip">
                  <CrownSimple size={10} weight="fill" className="mr-0.5" />
                  VIP
                </Badge>
              ) : (
                <Badge>Membro</Badge>
              )}
            </div>
            <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-neutral-400">
              <span>
                @
                {(email || user.email).split("@")[0]?.toLowerCase() || "user"}
              </span>
              <ProfileEmblem id={badgeEquipped} size={22} />
            </p>
            <p className="mt-1 text-[12px] text-neutral-400">
              Membro desde {formatDate(user.createdAt)}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-[13px]">
              <span>
                <strong className="font-semibold tabular-nums text-[#1f1f1f]">
                  {followerCount(user.id)}
                </strong>{" "}
                <span className="text-neutral-500">
                  {followerCount(user.id) === 1 ? "seguidor" : "seguidores"}
                </span>
              </span>
              <span>
                <strong className="font-semibold tabular-nums text-[#1f1f1f]">
                  {followingCount(user.id)}
                </strong>{" "}
                <span className="text-neutral-500">seguindo</span>
              </span>
            </div>
            {user.bio && (
              <p className="mt-3 max-w-[42ch] text-[14px] leading-relaxed text-neutral-600">
                <RichText text={user.bio} emojiSize={18} />
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Verificação */}
      {!user.isVerified ? (
        <Link
          href="/app/verification"
          className="card-interactive mb-6 flex items-center justify-between gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
              <VerifiedBadge size={20} />
            </div>
            <div>
              <p className="text-sm font-semibold text-sky-950">
                Obter perfil verificado
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-sky-800/80">
                Solicite o selo azul. Os admins revisam para evitar fakes.
              </p>
            </div>
          </div>
          <SealCheck size={20} weight="fill" className="shrink-0 text-sky-600" />
        </Link>
      ) : (
        <div className="mb-6 flex items-center gap-2 rounded-2xl border border-sky-100 bg-sky-50/60 px-4 py-3 text-sm text-sky-900">
          <VerifiedBadge size={18} />
          <span className="font-medium">Seu perfil é verificado</span>
        </div>
      )}

      <p className="mb-6 text-[13px] leading-relaxed text-neutral-500">
        Ao enviar foto ou banner, um editor abre para você{" "}
        <span className="font-medium text-neutral-700">
          posicionar e dar zoom
        </span>{" "}
        antes de aplicar.
      </p>

      {!user.isVip && (
        <Link
          href="/pricing"
          className="mb-6 flex items-center justify-between rounded-2xl border-2 border-neutral-200 bg-white p-4 transition-colors hover:border-[#1f1f1f]"
        >
          <div>
            <p className="text-sm font-semibold text-[#1f1f1f]">
              Desbloqueie o Plano VIP
            </p>
            <p className="text-xs text-neutral-500">
              Vídeos, materiais e salas exclusivas
            </p>
          </div>
          <CrownSimple size={18} weight="fill" />
        </Link>
      )}

      <form
        id="profile-edit-form"
        onSubmit={onSave}
        autoComplete="off"
        className="space-y-4 rounded-2xl border-2 border-neutral-200 bg-white p-6"
      >
        <h2 className="text-sm font-bold uppercase tracking-[0.1em] text-[#1f1f1f]">
          Editar dados
        </h2>
        <Input
          label="Nome"
          name="profile-name"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Input
          label="E-mail"
          type="email"
          name="profile-email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <EmblemPicker
          unlocked={badgesUnlocked}
          equipped={badgeEquipped}
          onEquip={(id) => setBadgeEquipped(id)}
        />

        <div>
          <Textarea
            ref={bioRef}
            label="Bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder={
              user?.isVip
                ? "Conte um pouco sobre você… VIP: use emojis custom com :nome:"
                : "Conte um pouco sobre você..."
            }
            className="min-h-[100px]"
            hint={
              user?.isVip
                ? "Emojis custom (:nome:) aparecem na bio pública."
                : undefined
            }
          />
          {user?.isVip && (
            <div className="relative mt-2">
              <button
                type="button"
                ref={bioEmojiBtnRef}
                onClick={() => setShowBioEmoji((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-600 transition hover:border-[#1f1f1f] hover:text-[#1f1f1f] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                aria-expanded={showBioEmoji}
              >
                <Smiley size={16} className="text-sky-500" />
                Emoji / Custom VIP
                <CrownSimple
                  size={12}
                  weight="fill"
                  className="text-amber-500"
                />
              </button>
              <EmojiPicker
                open={showBioEmoji}
                onClose={() => setShowBioEmoji(false)}
                panelRef={bioEmojiPanelRef}
                isVip={!!user.isVip}
                userId={user.id}
                userName={user.name}
                isAdmin={user.role === "admin"}
                onPickUnicode={(em) => insertIntoBio(em)}
                onPickCustom={(code) => insertIntoBio(code)}
                className="!left-0 !right-auto"
              />
              {bio.trim() && (
                <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 dark:border-zinc-700 dark:bg-zinc-900">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-neutral-400">
                    Prévia da bio
                  </p>
                  <p className="text-sm leading-relaxed text-neutral-700 dark:text-zinc-300">
                    <RichText text={bio} emojiSize={18} />
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Links na bio */}
        <div className="rounded-2xl border border-neutral-200/90 bg-gradient-to-b from-white to-neutral-50/80 p-4 shadow-[0_1px_2px_rgb(0_0_0/0.03)] sm:p-5">
          <div className="mb-3 flex items-end justify-between gap-2">
            <div>
              <p className="text-[13px] font-semibold tracking-tight text-[#1f1f1f]">
                Links na biografia
              </p>
              <p className="mt-0.5 text-xs text-neutral-500">
                {user?.isVip
                  ? `VIP: até ${linkLimit} links clicáveis`
                  : `Free: 1 link · VIP libera até 6`}
              </p>
            </div>
            <span className="text-[11px] font-medium tabular-nums text-neutral-400">
              {links.length}/{linkLimit}
            </span>
          </div>

          <div className="space-y-2 sm:grid sm:grid-cols-[1fr_1.4fr_auto] sm:items-end sm:gap-2 sm:space-y-0">
            <Input
              label="Rótulo (opcional)"
              placeholder="Instagram, Site..."
              value={linkLabel}
              onChange={(e) => setLinkLabel(e.target.value)}
              disabled={links.length >= linkLimit}
            />
            <Input
              label="URL"
              placeholder="https://..."
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              disabled={links.length >= linkLimit}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addLink();
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              className="w-full sm:mb-0 sm:h-12"
              onClick={addLink}
              disabled={links.length >= linkLimit || !linkUrl.trim()}
            >
              <Plus size={18} weight="bold" />
              Add
            </Button>
          </div>

          {!user?.isVip && links.length >= 1 && (
            <p className="mt-2 text-[11px] text-neutral-500">
              Quer mais links?{" "}
              <Link
                href="/pricing"
                className="font-semibold text-[#1f1f1f] underline underline-offset-2"
              >
                Assine o VIP
              </Link>
            </p>
          )}

          {links.length > 0 && (
            <ul className="mt-3 space-y-2">
              {links.map((l) => (
                <li
                  key={l.id}
                  className="flex items-center gap-2 rounded-xl border border-neutral-200/80 bg-white px-3 py-2.5 shadow-[0_1px_2px_rgb(0_0_0/0.03)]"
                >
                  <ProfileLinkIcon url={l.url} size={18} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#1f1f1f]">
                      {l.label || "Link"}
                    </p>
                    <p className="truncate text-xs text-neutral-500">{l.url}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setLinks((prev) => prev.filter((x) => x.id !== l.id))
                    }
                    className="pressable shrink-0 rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-[#1f1f1f]"
                    aria-label="Remover link"
                  >
                    <X size={16} weight="bold" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Músicas favoritas — VIP */}
        <div className="rounded-2xl border border-neutral-200/90 bg-gradient-to-b from-white to-neutral-50/80 p-4 shadow-[0_1px_2px_rgb(0_0_0/0.03)] sm:p-5 dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-950">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="flex items-center gap-1.5 text-[13px] font-semibold tracking-tight text-[#1f1f1f] dark:text-zinc-100">
                <Headphones size={16} weight="bold" />
                Ouvindo agora
                <CrownSimple
                  size={13}
                  weight="fill"
                  className="text-amber-500"
                />
              </p>
              <p className="mt-0.5 text-xs text-neutral-500">
                {user?.isVip
                  ? `Spotify, YouTube ou SoundCloud · até ${trackLimit} faixas`
                  : "Exclusivo VIP — mostre o que você está escutando"}
              </p>
            </div>
            {user?.isVip ? (
              <span className="text-[11px] font-medium tabular-nums text-neutral-400">
                {tracks.length}/{trackLimit}
              </span>
            ) : (
              <Link href="/pricing">
                <Button type="button" size="sm" variant="outline">
                  Obter VIP
                </Button>
              </Link>
            )}
          </div>

          {user?.isVip ? (
            <>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {(
                  [
                    ["auto", "Auto"],
                    ["spotify", "Spotify"],
                    ["youtube", "YouTube"],
                    ["soundcloud", "SoundCloud"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTrackPlatform(id)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition",
                      trackPlatform === id
                        ? "border-[#1f1f1f] bg-[#1f1f1f] text-white"
                        : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                    )}
                  >
                    {id !== "auto" && (
                      <MusicPlatformIcon platform={id} size={12} />
                    )}
                    {label}
                  </button>
                ))}
              </div>

              <div className="space-y-2 sm:grid sm:grid-cols-[1fr_1.4fr_auto] sm:items-end sm:gap-2 sm:space-y-0">
                <Input
                  label="Título (opcional)"
                  placeholder="Nome da faixa / vibe"
                  value={trackTitle}
                  onChange={(e) => setTrackTitle(e.target.value)}
                  disabled={tracks.length >= trackLimit}
                />
                <Input
                  label="Link da música"
                  placeholder={
                    trackPlatform === "auto"
                      ? "https://open.spotify.com/… ou YouTube / SoundCloud"
                      : MUSIC_PLATFORM_META[trackPlatform].placeholder
                  }
                  value={trackUrl}
                  onChange={(e) => setTrackUrl(e.target.value)}
                  disabled={tracks.length >= trackLimit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTrack();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:mb-0 sm:h-12"
                  onClick={() => void addTrack()}
                  disabled={
                    trackLoading ||
                    tracks.length >= trackLimit ||
                    !trackUrl.trim()
                  }
                >
                  <Plus size={18} weight="bold" />
                  {trackLoading ? "Buscando…" : "Add"}
                </Button>
              </div>
              <p className="mt-2 text-[11px] text-neutral-400">
                Cole o link — buscamos automaticamente o nome da faixa e do
                artista, e liberamos o player no perfil.
              </p>

              {tracks.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {tracks.map((t) => (
                    <li
                      key={t.id}
                      className="flex items-center gap-2.5 rounded-xl border border-neutral-200/80 bg-white px-3 py-2.5 shadow-[0_1px_2px_rgb(0_0_0/0.03)] dark:border-zinc-700 dark:bg-zinc-900"
                    >
                      {t.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={t.thumbnailUrl}
                          alt=""
                          className="h-10 w-10 shrink-0 rounded-lg object-cover"
                        />
                      ) : (
                        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-neutral-50 dark:bg-zinc-800">
                          <MusicPlatformIcon
                            platform={t.platform}
                            size={18}
                          />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[#1f1f1f] dark:text-zinc-100">
                          {t.title}
                        </p>
                        <p className="truncate text-[11px] text-neutral-500">
                          {t.artist || musicPlatformLabel(t.platform)}
                          <span className="text-neutral-300"> · </span>
                          {musicPlatformLabel(t.platform)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setTracks((prev) =>
                            prev.filter((x) => x.id !== t.id)
                          )
                        }
                        className="pressable shrink-0 rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-[#1f1f1f]"
                        aria-label="Remover música"
                      >
                        <X size={16} weight="bold" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-neutral-300 bg-white/60 px-3 py-4 dark:border-zinc-700 dark:bg-zinc-900/50">
              <MusicPlatformIcon platform="spotify" size={22} />
              <MusicPlatformIcon platform="youtube" size={22} />
              <MusicPlatformIcon platform="soundcloud" size={22} />
              <p className="text-xs text-neutral-500">
                Assine o VIP para listar suas faixas favoritas no perfil.
              </p>
            </div>
          )}
        </div>

        {/* Interesses */}
        <div className="rounded-2xl border border-neutral-200/90 bg-gradient-to-b from-white to-neutral-50/80 p-4 shadow-[0_1px_2px_rgb(0_0_0/0.03)] sm:p-5">
          <div className="mb-3 flex items-end justify-between gap-2">
            <div>
              <p className="text-[13px] font-semibold tracking-tight text-[#1f1f1f]">
                Interesses
              </p>
              <p className="mt-0.5 text-xs text-neutral-500">
                Selecione os temas mais relevantes para você
              </p>
            </div>
            {interests.length > 0 && (
              <span className="text-[11px] font-medium tabular-nums text-neutral-400">
                {interests.length} selecionado
                {interests.length === 1 ? "" : "s"}
              </span>
            )}
          </div>
          <TagChips
            tags={INTEREST_OPTIONS}
            selected={interests}
            onToggle={toggleInterest}
          />
        </div>

        {/* Objetivos */}
        <div className="rounded-2xl border border-neutral-200/90 bg-gradient-to-b from-white to-neutral-50/80 p-4 shadow-[0_1px_2px_rgb(0_0_0/0.03)] sm:p-5">
          <div className="mb-3 flex items-end justify-between gap-2">
            <div>
              <p className="text-[13px] font-semibold tracking-tight text-[#1f1f1f]">
                Objetivos
              </p>
              <p className="mt-0.5 text-xs text-neutral-500">
                Até {MAX_GOALS} objetivos pessoais
              </p>
            </div>
            <span className="text-[11px] font-medium tabular-nums text-neutral-400">
              {goals.length}/{MAX_GOALS}
            </span>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder={GOAL_PLACEHOLDER}
              value={customGoal}
              onChange={(e) => setCustomGoal(e.target.value)}
              disabled={goals.length >= MAX_GOALS}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addGoal(customGoal);
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => addGoal(customGoal)}
              disabled={goals.length >= MAX_GOALS || !customGoal.trim()}
              aria-label="Adicionar objetivo"
            >
              <Plus size={18} weight="bold" />
            </Button>
          </div>
          {goals.length > 0 && (
            <ul className="mt-3 space-y-2">
              {goals.map((g) => (
                <li
                  key={g}
                  className="flex items-start gap-2 rounded-xl border border-neutral-200/80 bg-white px-3 py-2.5 text-sm text-neutral-700 shadow-[0_1px_2px_rgb(0_0_0/0.03)]"
                >
                  <span className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">
                    {g}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setGoals((prev) => prev.filter((x) => x !== g))
                    }
                    className="pressable shrink-0 rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-[#1f1f1f]"
                    aria-label="Remover objetivo"
                  >
                    <X size={16} weight="bold" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Mentoria */}
        <div className="space-y-4 rounded-2xl border border-neutral-200/90 bg-gradient-to-b from-white to-neutral-50/80 p-4 shadow-[0_1px_2px_rgb(0_0_0/0.03)] sm:p-5">
          <div>
            <p className="text-[13px] font-semibold tracking-tight text-[#1f1f1f]">
              Mentoria
            </p>
            <p className="mt-0.5 text-xs text-neutral-500">
              Ative se busca ou oferece mentoria na comunidade
            </p>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-neutral-200/80 bg-white px-3.5 py-3 shadow-[0_1px_2px_rgb(0_0_0/0.02)] transition-colors hover:border-neutral-300">
            <input
              type="checkbox"
              checked={seekingMentorship}
              onChange={(e) => setSeekingMentorship(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[#1f1f1f]"
            />
            <span className="text-sm text-neutral-700">
              Estou buscando mentoria
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-neutral-200/80 bg-white px-3.5 py-3 shadow-[0_1px_2px_rgb(0_0_0/0.02)] transition-colors hover:border-neutral-300">
            <input
              type="checkbox"
              checked={offeringMentorship}
              onChange={(e) => setOfferingMentorship(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[#1f1f1f]"
            />
            <span className="text-sm text-neutral-700">
              Ofereço mentoria para outros membros
            </span>
          </label>

          {offeringMentorship && (
            <div className="space-y-3 rounded-xl border border-neutral-200/80 bg-white p-3.5 shadow-[inset_0_1px_0_rgb(255_255_255/0.8)]">
              <div>
                <p className="text-[12px] font-semibold text-[#1f1f1f]">
                  Temas em que você mentoraria
                </p>
                <p className="mt-0.5 text-[11px] text-neutral-500">
                  Selecione da lista ou adicione um nicho personalizado
                </p>
              </div>
              <TagChips
                tags={INTEREST_OPTIONS}
                selected={mentorTopics.filter((t) =>
                  INTEREST_OPTIONS.some(
                    (o) => o.toLowerCase() === t.toLowerCase()
                  )
                )}
                onToggle={toggleMentorTopic}
              />
              {/* Temas personalizados já adicionados */}
              {mentorTopics.filter(
                (t) =>
                  !INTEREST_OPTIONS.some(
                    (o) => o.toLowerCase() === t.toLowerCase()
                  )
              ).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {mentorTopics
                    .filter(
                      (t) =>
                        !INTEREST_OPTIONS.some(
                          (o) => o.toLowerCase() === t.toLowerCase()
                        )
                    )
                    .map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-1.5 rounded-full bg-[#1f1f1f] px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        {t}
                        <button
                          type="button"
                          onClick={() => toggleMentorTopic(t)}
                          className="rounded-full p-0.5 hover:bg-white/20"
                          aria-label={`Remover ${t}`}
                        >
                          <X size={12} weight="bold" />
                        </button>
                      </span>
                    ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  placeholder="Nicho personalizado (ex.: Funis de iGaming)"
                  value={customMentorTopic}
                  onChange={(e) => setCustomMentorTopic(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addMentorTopic(customMentorTopic);
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => addMentorTopic(customMentorTopic)}
                  disabled={!customMentorTopic.trim()}
                  aria-label="Adicionar tema de mentoria"
                >
                  <Plus size={18} weight="bold" />
                </Button>
              </div>
            </div>
          )}

          <Link
            href="/app/mentorship"
            className="inline-flex text-xs font-semibold text-[#1f1f1f] underline underline-offset-2 transition-opacity hover:opacity-70"
          >
            Ver matches de mentoria
          </Link>
        </div>

        {/* Senha isolada: o campo type=password no form principal era autofillado
            e o Supabase recusava “same password”, abortando foto/GIF. */}
        <div className="rounded-xl border border-neutral-200 bg-neutral-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-[#1f1f1f] dark:text-zinc-100">
                Senha
              </p>
              <p className="mt-0.5 text-xs text-neutral-500">
                Opcional — não é necessária para salvar foto, banner ou GIF.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setChangePassword((v) => !v);
                setPassword("");
              }}
            >
              {changePassword ? "Cancelar" : "Alterar senha"}
            </Button>
          </div>
          {changePassword && (
            <div className="mt-3">
              <Input
                label="Nova senha"
                type="password"
                name="nullysh-new-password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                hint="Só será enviada se você digitar aqui e salvar."
              />
            </div>
          )}
        </div>
        <p className="text-xs text-neutral-500">
          Foto e banner estáticos: até 20 MB no envio. Após o recorte, a imagem
          é comprimida em alta qualidade (WebP/JPEG) para ocupar menos storage.
          {user.isVip ? (
            <>
              {" "}
              <span className="font-semibold text-[#1f1f1f]">
                VIP: banners GIF animados liberados
              </span>{" "}
              (até 15 MB; GIFs não são re-encodados para manter a animação). Use
              Posicionar GIF para enquadrar antes de salvar.
            </>
          ) : (
            <>
              {" "}
              Banners animados (GIF) são exclusivos do{" "}
              <Link
                href="/pricing"
                className="font-semibold text-[#1f1f1f] underline underline-offset-2"
              >
                Plano VIP
              </Link>
              .
            </>
          )}
        </p>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              logout();
              router.push("/");
            }}
          >
            Sair da conta
          </Button>
        </div>
      </form>

      <div className="mt-6 rounded-2xl border border-red-200 bg-red-50/40 p-6">
        <h2 className="text-[13px] font-semibold text-red-800">Zona de perigo</h2>
        <p className="mt-1 text-sm leading-relaxed text-red-700/80">
          Exclui permanentemente sua conta deste navegador (CRUD delete).
        </p>
        <Button
          type="button"
          variant="danger"
          className="mt-4"
          onClick={onDelete}
        >
          <Trash size={16} weight="bold" />
          Excluir conta
        </Button>
      </div>

      {/* Menu compacto no topo — discreto, segue o scroll até salvar */}
      {showStickySave && (
        <div
          className={cn(
            // mobile: abaixo do header do app; desktop: topo discreto
            "fixed left-1/2 top-[3.75rem] z-50 -translate-x-1/2",
            "lg:top-3"
          )}
        >
          <div
            className={cn(
              "flex items-center gap-2.5 rounded-full border border-neutral-200/80",
              "bg-white/90 px-2 py-1.5 pl-3.5 shadow-sm backdrop-blur-md",
              "dark:border-zinc-700 dark:bg-zinc-900/90"
            )}
          >
            {error ? (
              <span className="max-w-[10rem] truncate text-xs text-red-600 sm:max-w-[16rem]">
                {error}
              </span>
            ) : saving ? (
              <span className="text-xs text-neutral-500">Enviando mídia…</span>
            ) : message ? (
              <span className="inline-flex max-w-[10rem] items-center gap-1.5 truncate text-xs text-neutral-500 sm:max-w-[16rem]">
                <CheckCircle size={14} weight="fill" className="shrink-0 text-emerald-600" />
                Salvo
              </span>
            ) : (
              <span className="text-xs text-neutral-400">Não salvo</span>
            )}
            <button
              type="submit"
              form="profile-edit-form"
              disabled={saving}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-full px-3.5",
                "bg-[#1f1f1f] text-xs font-semibold text-white",
                "transition hover:bg-black active:scale-[0.98]",
                "dark:bg-white dark:text-black dark:hover:bg-neutral-200",
                saving && "pointer-events-none opacity-60"
              )}
            >
              <FloppyDisk size={14} weight="bold" />
              {saving ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </div>
      )}

      {cropSrc && (
        <ImageCropEditor
          open={cropOpen}
          imageSrc={cropSrc}
          kind={cropKind}
          onCancel={closeCropEditor}
          onConfirm={onCropConfirm}
        />
      )}

      {gifEditorSrc && (
        <GifBannerEditor
          open={gifEditorOpen}
          imageSrc={gifEditorSrc}
          initialFit={bannerFit}
          onCancel={onGifFitCancel}
          onConfirm={onGifFitConfirm}
        />
      )}
    </div>
  );
}
