"use client";

/**
 * Chip de música no post + playback no feed.
 *
 * YouTube: IFrame API (autoplay no viewport após unlock; som no clique).
 * Spotify / SoundCloud: player oficial VISÍVEL no clique — iframe 1px
 * escondido NÃO toca (bloqueio das plataformas + política de autoplay).
 */

import { MusicPlatformIcon } from "@/components/music-platform-icon";
import {
  buildEmbedUrl,
  parseYoutubeId,
  type MusicPlatform,
} from "@/lib/music";
import {
  isPostMusicAudioUnlocked,
  reportPostMusicVisibility,
  unlockPostMusicAudio,
  unregisterPostMusic,
} from "@/lib/post-music-controller";
import type { PostMusic } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MusicNotes, Pause, Play, SpinnerGap } from "@phosphor-icons/react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react";

/* ── YouTube IFrame API ── */

type YTPlayerLite = {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  mute: () => void;
  unMute: () => void;
  setVolume: (v: number) => void;
  destroy: () => void;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type YTAny = any;

function getWindowYT(): YTAny {
  return (window as YTAny).YT;
}

let ytApiPromise: Promise<YTAny> | null = null;

function loadYouTubeApi(): Promise<YTAny> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("no window"));
  }
  const existing = getWindowYT();
  if (existing?.Player) return Promise.resolve(existing);
  if (ytApiPromise) return ytApiPromise;

  ytApiPromise = new Promise((resolve) => {
    const w = window as YTAny;
    const prev = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      prev?.();
      if (getWindowYT()) resolve(getWindowYT());
    };
    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      tag.async = true;
      document.head.appendChild(tag);
    }
    const poll = window.setInterval(() => {
      if (getWindowYT()?.Player) {
        window.clearInterval(poll);
        resolve(getWindowYT());
      }
    }, 40);
  });
  return ytApiPromise;
}

function spotifyEmbedSrc(music: PostMusic): string | null {
  const base =
    music.embedUrl ||
    buildEmbedUrl("spotify", music.url) ||
    null;
  if (!base) return null;
  try {
    const u = new URL(base);
    // compact theme; t= só funciona bem em episódios, mas não atrapalha tracks
    if (music.startAtSec > 0) {
      u.searchParams.set("t", String(music.startAtSec));
    }
    u.searchParams.set("utm_source", "generator");
    u.searchParams.set("theme", "0");
    return u.toString();
  } catch {
    return base;
  }
}

function soundcloudEmbedSrc(music: PostMusic): string | null {
  const base =
    music.embedUrl ||
    buildEmbedUrl("soundcloud", music.url) ||
    null;
  if (!base) return null;
  try {
    const u = new URL(base);
    u.searchParams.set("auto_play", "true");
    u.searchParams.set("hide_related", "true");
    u.searchParams.set("show_comments", "false");
    u.searchParams.set("visual", "false");
    return u.toString();
  } catch {
    return base;
  }
}

type Props = {
  postId: string;
  music: PostMusic;
  className?: string;
  observeRoot?: HTMLElement | null;
};

export function PostFeedMusic({
  postId,
  music,
  className,
  observeRoot,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayerLite | null>(null);
  const loopTimer = useRef<number | null>(null);
  const wantPlay = useRef(false);
  /** clique manual → pode tocar com som / abrir embed Spotify */
  const userGesture = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hostKey, setHostKey] = useState(0);
  const [showExternalPlayer, setShowExternalPlayer] = useState(false);
  const reactId = useId().replace(/:/g, "");
  const hostDomId = `post-yt-${postId.slice(0, 8)}-${reactId}`;

  const isYoutube = music.platform === "youtube";
  const isSpotify = music.platform === "spotify";
  const isSoundcloud = music.platform === "soundcloud";

  const videoId = useMemo(() => {
    if (!isYoutube) return null;
    return (
      parseYoutubeId(music.url) ||
      parseYoutubeId(music.embedUrl || "") ||
      null
    );
  }, [isYoutube, music.url, music.embedUrl]);

  const startAt = music.startAtSec || 0;
  const clipDur = music.clipDurationSec || 30;

  const spotifySrc = useMemo(
    () => (isSpotify ? spotifyEmbedSrc(music) : null),
    [isSpotify, music]
  );
  const soundcloudSrc = useMemo(
    () => (isSoundcloud ? soundcloudEmbedSrc(music) : null),
    [isSoundcloud, music]
  );

  const destroyYt = useCallback(() => {
    if (loopTimer.current) {
      window.clearInterval(loopTimer.current);
      loopTimer.current = null;
    }
    try {
      playerRef.current?.destroy();
    } catch {
      /* ignore */
    }
    playerRef.current = null;
    setHostKey((k) => k + 1);
  }, []);

  const pauseInternal = useCallback(() => {
    wantPlay.current = false;
    setPlaying(false);
    setLoading(false);
    setShowExternalPlayer(false);
    try {
      playerRef.current?.pauseVideo();
    } catch {
      /* ignore */
    }
  }, []);

  const playInternal = useCallback(() => {
    // Autoplay por scroll: só YouTube (Spotify/SC precisam de clique + player visível)
    if (!isYoutube && !userGesture.current) {
      return;
    }
    wantPlay.current = true;
    setPlaying(true);
    if (!isYoutube) {
      setShowExternalPlayer(true);
    }
  }, [isYoutube]);

  // YouTube player lifecycle
  useEffect(() => {
    if (!isYoutube || !videoId) return;
    if (!playing) {
      try {
        playerRef.current?.pauseVideo();
      } catch {
        /* ignore */
      }
      if (loopTimer.current) {
        window.clearInterval(loopTimer.current);
        loopTimer.current = null;
      }
      return;
    }

    let cancelled = false;
    setLoading(true);
    const withSound =
      isPostMusicAudioUnlocked() || userGesture.current;

    (async () => {
      const YT = await loadYouTubeApi();
      if (cancelled || !wantPlay.current) return;

      if (playerRef.current) {
        try {
          playerRef.current.seekTo(startAt, true);
          if (withSound) {
            playerRef.current.unMute();
            playerRef.current.setVolume(90);
          } else {
            playerRef.current.mute();
          }
          playerRef.current.playVideo();
          setLoading(false);
          return;
        } catch {
          destroyYt();
        }
      }

      const host = document.getElementById(hostDomId);
      if (!host) {
        setLoading(false);
        return;
      }

      playerRef.current = new YT.Player(hostDomId, {
        height: "1",
        width: "1",
        videoId,
        playerVars: {
          autoplay: 1,
          start: startAt,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          // 0 = com som (após gesto); 1 = mudo (autoplay viewport)
          mute: withSound ? 0 : 1,
          origin:
            typeof window !== "undefined" ? window.location.origin : undefined,
        },
        events: {
          onReady: (e: { target: YTPlayerLite }) => {
            if (cancelled || !wantPlay.current) return;
            try {
              e.target.seekTo(startAt, true);
              if (withSound) {
                e.target.unMute();
                e.target.setVolume(90);
              } else {
                e.target.mute();
              }
              e.target.playVideo();
            } catch {
              /* ignore */
            }
            setLoading(false);
          },
          onStateChange: (e: { data: number; target: YTPlayerLite }) => {
            if (cancelled) return;
            const S = YT.PlayerState;
            if (e.data === S.PLAYING) {
              setPlaying(true);
              setLoading(false);
              // Se o user já liberou áudio, garante unmute
              if (isPostMusicAudioUnlocked() || userGesture.current) {
                try {
                  e.target.unMute();
                  e.target.setVolume(90);
                } catch {
                  /* ignore */
                }
              }
            } else if (e.data === S.ENDED) {
              try {
                e.target.seekTo(startAt, true);
                e.target.playVideo();
              } catch {
                /* ignore */
              }
            }
          },
        },
      }) as YTPlayerLite;

      if (loopTimer.current) window.clearInterval(loopTimer.current);
      loopTimer.current = window.setInterval(() => {
        const p = playerRef.current;
        if (!p || !wantPlay.current) return;
        try {
          const t = p.getCurrentTime();
          if (t >= startAt + clipDur) {
            p.seekTo(startAt, true);
          }
        } catch {
          /* ignore */
        }
      }, 400);
    })();

    return () => {
      cancelled = true;
    };
  }, [
    playing,
    videoId,
    isYoutube,
    hostDomId,
    startAt,
    clipDur,
    destroyYt,
  ]);

  useEffect(() => {
    return () => {
      destroyYt();
      unregisterPostMusic(postId);
    };
  }, [destroyYt, postId]);

  // Viewport autoplay — apenas YouTube
  useEffect(() => {
    if (!isYoutube) return;

    const target =
      observeRoot ||
      (typeof document !== "undefined"
        ? document.getElementById(`post-${postId}`)
        : null) ||
      rootRef.current;
    if (!target || typeof IntersectionObserver === "undefined") return;

    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;

        const root =
          entry.rootBounds ||
          ({
            top: 0,
            height: window.innerHeight,
            bottom: window.innerHeight,
            left: 0,
            width: window.innerWidth,
            right: window.innerWidth,
            x: 0,
            y: 0,
            toJSON: () => ({}),
          } as DOMRectReadOnly);

        const ratio = entry.intersectionRatio;
        if (!entry.isIntersecting || ratio < 0.2) {
          reportPostMusicVisibility(postId, 0, {
            play: playInternal,
            pause: pauseInternal,
          });
          return;
        }

        const mid = root.top + root.height / 2;
        const r = entry.boundingClientRect;
        const postMid = r.top + r.height / 2;
        const dist = Math.min(1, Math.abs(postMid - mid) / (root.height * 0.5));
        const score = ratio * (1 - dist * 0.85);

        reportPostMusicVisibility(postId, score, {
          play: playInternal,
          pause: pauseInternal,
        });
      },
      {
        threshold: [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1],
        root: null,
        rootMargin: "0px",
      }
    );

    io.observe(target);
    return () => {
      io.disconnect();
      unregisterPostMusic(postId);
    };
  }, [postId, observeRoot, playInternal, pauseInternal, isYoutube]);

  function toggleManual(e?: MouseEvent) {
    e?.stopPropagation();
    // Gesto do usuário → libera áudio no browser + YouTube unmute
    unlockPostMusicAudio();
    userGesture.current = true;

    if (playing) {
      pauseInternal();
      unregisterPostMusic(postId);
      reportPostMusicVisibility(postId, 0, {
        play: playInternal,
        pause: pauseInternal,
      });
      return;
    }

    // Spotify / SC: abre player oficial visível (única forma confiável de ouvir)
    if (!isYoutube) {
      wantPlay.current = true;
      setPlaying(true);
      setShowExternalPlayer(true);
      setLoading(false);
      // Pausa outros posts YouTube via controller
      reportPostMusicVisibility(postId, 1, {
        play: playInternal,
        pause: pauseInternal,
      });
      return;
    }

    // YouTube: play com som
    wantPlay.current = true;
    setPlaying(true);
    reportPostMusicVisibility(postId, 1, {
      play: playInternal,
      pause: pauseInternal,
    });
  }

  const title = music.title?.trim() || "Faixa";
  const artist = music.artist?.trim() || "";
  const platform = music.platform as MusicPlatform;

  const externalSrc = isSpotify
    ? spotifySrc
    : isSoundcloud
      ? soundcloudSrc
      : null;

  return (
    <div ref={rootRef} className={cn("mt-3 space-y-2", className)}>
      {/* Host YT offscreen — só o áudio; UI é o chip */}
      {isYoutube && videoId && (
        <div className="pointer-events-none absolute h-px w-px overflow-hidden opacity-0">
          <div key={hostKey} id={hostDomId} />
        </div>
      )}

      <button
        type="button"
        onClick={toggleManual}
        className={cn(
          "group/music flex w-full max-w-full items-center gap-2.5 rounded-full",
          "border border-neutral-200/90 bg-neutral-50/90 py-1.5 pl-1.5 pr-3.5 text-left",
          "shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition",
          "hover:border-neutral-300 hover:bg-white",
          "dark:border-zinc-700 dark:bg-zinc-900/80 dark:hover:bg-zinc-900",
          playing &&
            "border-[#1f1f1f]/20 bg-[#1f1f1f]/[0.04] dark:border-white/20"
        )}
        aria-label={playing ? "Pausar música" : "Tocar música"}
      >
        <span
          className={cn(
            "relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full",
            "bg-[#1f1f1f] text-white",
            playing && isYoutube && "animate-[spin_8s_linear_infinite]"
          )}
        >
          {music.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={music.thumbnailUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <MusicNotes size={16} weight="fill" />
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 transition group-hover/music:opacity-100 sm:opacity-100 sm:bg-black/25">
            {loading ? (
              <SpinnerGap size={14} className="animate-spin" />
            ) : playing ? (
              <Pause size={14} weight="fill" />
            ) : (
              <Play size={14} weight="fill" className="ml-0.5" />
            )}
          </span>
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <MusicPlatformIcon platform={platform} size={12} />
            <span className="truncate text-[13px] font-semibold tracking-tight text-[#1f1f1f] dark:text-zinc-100">
              {title}
            </span>
          </span>
          <span className="mt-0.5 block truncate text-[11px] text-neutral-500">
            {artist ||
              (isSpotify
                ? "Spotify"
                : isSoundcloud
                  ? "SoundCloud"
                  : "YouTube")}
            {playing && isYoutube ? " · tocando" : ""}
            {playing && isSpotify && showExternalPlayer
              ? " · use o play no player"
              : ""}
            {!playing && (isSpotify || isSoundcloud)
              ? " · toque para ouvir"
              : ""}
          </span>
        </span>

        {playing && isYoutube && (
          <span
            className="post-music-bars flex h-4 items-end gap-0.5"
            aria-hidden
          >
            <span className="post-music-bar w-0.5 rounded-full bg-[#1f1f1f] dark:bg-zinc-200" />
            <span className="post-music-bar post-music-bar--2 w-0.5 rounded-full bg-[#1f1f1f] dark:bg-zinc-200" />
            <span className="post-music-bar post-music-bar--3 w-0.5 rounded-full bg-[#1f1f1f] dark:bg-zinc-200" />
          </span>
        )}
      </button>

      {/*
        Spotify / SoundCloud: player oficial compacto VISÍVEL.
        Sem isso o áudio não sai (política da plataforma + browser).
      */}
      {showExternalPlayer && externalSrc && (
        <div
          className={cn(
            "overflow-hidden rounded-xl border border-neutral-200/90 bg-white",
            "dark:border-zinc-700 dark:bg-zinc-900"
          )}
        >
          <iframe
            title={`${platform}-player`}
            src={externalSrc}
            className={cn(
              "w-full border-0",
              isSpotify ? "h-[80px]" : "h-[120px]"
            )}
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="eager"
            // Spotify exige allow transparency em alguns browsers
            allowFullScreen
          />
          <p className="px-2.5 pb-2 text-[11px] leading-snug text-neutral-500">
            {isSpotify
              ? "Clique em ▶ no player do Spotify para ouvir. Conta free pode ter preview de ~30s."
              : "Clique em ▶ no player se o áudio não iniciar sozinho."}
          </p>
        </div>
      )}
    </div>
  );
}
