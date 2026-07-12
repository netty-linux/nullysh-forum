"use client";

/**
 * Chip de música no post + autoplay estilo Instagram:
 * - Toca quando o card está centralizado no feed
 * - Pausa/mute ao rolar para fora
 * - Um post por vez (controller global)
 * - Trecho com startAtSec + loop clipDurationSec (YouTube)
 */

import { MusicPlatformIcon } from "@/components/music-platform-icon";
import { parseYoutubeId, type MusicPlatform } from "@/lib/music";
import {
  isPostMusicAudioUnlocked,
  reportPostMusicVisibility,
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
} from "react";

/* ── YouTube IFrame API (tipos locais, sem re-declarar Window) ── */

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

type Props = {
  postId: string;
  music: PostMusic;
  className?: string;
  /** Elemento raiz do card (observer) — se omitido, usa o chip */
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
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const loopTimer = useRef<number | null>(null);
  const wantPlay = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hostKey, setHostKey] = useState(0);
  const reactId = useId().replace(/:/g, "");
  const hostDomId = `post-yt-${postId.slice(0, 8)}-${reactId}`;

  const videoId = useMemo(() => {
    if (music.platform !== "youtube") return null;
    return (
      parseYoutubeId(music.url) ||
      parseYoutubeId(music.embedUrl || "") ||
      null
    );
  }, [music.platform, music.url, music.embedUrl]);

  const startAt = music.startAtSec || 0;
  const clipDur = music.clipDurationSec || 30;

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
    try {
      playerRef.current?.pauseVideo();
    } catch {
      /* ignore */
    }
    // Spotify/SC: remove iframe autoplay
    iframeRef.current = null;
  }, []);

  const playInternal = useCallback(() => {
    wantPlay.current = true;
    setPlaying(true);
  }, []);

  // YouTube player lifecycle
  useEffect(() => {
    if (music.platform !== "youtube" || !videoId) return;
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

    (async () => {
      const YT = await loadYouTubeApi();
      if (cancelled || !wantPlay.current) return;

      if (playerRef.current) {
        try {
          playerRef.current.seekTo(startAt, true);
          if (isPostMusicAudioUnlocked()) {
            playerRef.current.unMute();
            playerRef.current.setVolume(85);
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
          mute: isPostMusicAudioUnlocked() ? 0 : 1,
          origin:
            typeof window !== "undefined" ? window.location.origin : undefined,
        },
        events: {
          onReady: (e: { target: YTPlayerLite }) => {
            if (cancelled || !wantPlay.current) return;
            try {
              e.target.seekTo(startAt, true);
              if (isPostMusicAudioUnlocked()) {
                e.target.unMute();
                e.target.setVolume(85);
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

      // Loop do trecho (start → start+clip)
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
    music.platform,
    hostDomId,
    startAt,
    clipDur,
    destroyYt,
  ]);

  // cleanup unmount
  useEffect(() => {
    return () => {
      destroyYt();
      unregisterPostMusic(postId);
    };
  }, [destroyYt, postId]);

  // IntersectionObserver → score de centralização
  useEffect(() => {
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
        // 0 no centro, 1 nas bordas
        const dist = Math.min(1, Math.abs(postMid - mid) / (root.height * 0.5));
        // score: alto quando visível + perto do centro
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
  }, [postId, observeRoot, playInternal, pauseInternal]);

  // Spotify / SoundCloud embed when active
  const externalEmbed = useMemo(() => {
    if (!playing) return null;
    if (music.platform === "youtube") return null;
    if (!music.embedUrl) return null;
    try {
      const u = new URL(music.embedUrl);
      if (music.platform === "spotify") {
        // Spotify embed autoplay limitado — tenta
        u.searchParams.set("utm_source", "generator");
      }
      if (music.platform === "soundcloud") {
        u.searchParams.set("auto_play", "true");
      }
      return u.toString();
    } catch {
      return music.embedUrl;
    }
  }, [playing, music.platform, music.embedUrl]);

  function toggleManual() {
    if (playing) {
      pauseInternal();
      unregisterPostMusic(postId);
      // re-report 0 so controller doesn't restart immediately
      reportPostMusicVisibility(postId, 0, {
        play: playInternal,
        pause: pauseInternal,
      });
    } else {
      playInternal();
      // força este post como ativo
      reportPostMusicVisibility(postId, 1, {
        play: playInternal,
        pause: pauseInternal,
      });
    }
  }

  const title = music.title?.trim() || "Faixa";
  const artist = music.artist?.trim() || "";

  return (
    <div ref={rootRef} className={cn("mt-3", className)}>
      {/* Host YT offscreen */}
      {music.platform === "youtube" && videoId && (
        <div className="pointer-events-none absolute h-px w-px overflow-hidden opacity-0">
          <div key={hostKey} id={hostDomId} />
        </div>
      )}

      {/* Embeds SC/Spotify hidden when playing */}
      {externalEmbed && (
        <div className="pointer-events-none absolute h-px w-px overflow-hidden opacity-0">
          <iframe
            ref={iframeRef}
            title="post-music"
            src={externalEmbed}
            allow="autoplay; encrypted-media"
            className="h-px w-px border-0"
          />
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
          playing && "border-[#1f1f1f]/20 bg-[#1f1f1f]/[0.04] dark:border-white/20"
        )}
        aria-label={playing ? "Pausar música" : "Tocar música"}
      >
        {/* Disco / capa */}
        <span
          className={cn(
            "relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full",
            "bg-[#1f1f1f] text-white",
            playing && "animate-[spin_8s_linear_infinite]"
          )}
          style={
            playing
              ? undefined
              : { animationPlayState: "paused" }
          }
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
          <span className="absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 transition group-hover/music:opacity-100">
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
            <MusicPlatformIcon platform={music.platform as MusicPlatform} size={12} />
            <span className="truncate text-[13px] font-semibold tracking-tight text-[#1f1f1f] dark:text-zinc-100">
              {title}
            </span>
          </span>
          {artist ? (
            <span className="mt-0.5 block truncate text-[11px] text-neutral-500">
              {artist}
              {playing ? " · tocando" : ""}
            </span>
          ) : (
            playing && (
              <span className="mt-0.5 block text-[11px] text-neutral-500">
                tocando
              </span>
            )
          )}
        </span>

        {/* Barrinhas estilo IG quando tocando */}
        {playing && (
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

    </div>
  );
}
