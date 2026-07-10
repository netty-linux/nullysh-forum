"use client";

import {
  MusicPlatformIcon,
  musicPlatformLabel,
} from "@/components/music-platform-icon";
import {
  buildEmbedUrl,
  parseYoutubeId,
  type FavoriteTrack,
} from "@/lib/music";
import { cn, normalizeUrl } from "@/lib/utils";
import { Pause, Play, SpeakerHigh, SpeakerSlash } from "@phosphor-icons/react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

/* ─── YouTube IFrame API (progresso real) ─── */

type YTPlayer = {
  playVideo: () => void;
  pauseVideo: () => void;
  stopVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  setVolume: (vol: number) => void;
  getVolume: () => number;
  mute: () => void;
  unMute: () => void;
  isMuted: () => boolean;
  destroy: () => void;
};

type YTNamespace = {
  Player: new (
    el: string | HTMLElement,
    opts: Record<string, unknown>
  ) => YTPlayer;
  PlayerState: {
    ENDED: number;
    PLAYING: number;
    PAUSED: number;
    BUFFERING: number;
    CUED: number;
  };
};

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytApiPromise: Promise<YTNamespace> | null = null;

function loadYouTubeApi(): Promise<YTNamespace> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("no window"));
  }
  if (window.YT?.Player) {
    return Promise.resolve(window.YT);
  }
  if (ytApiPromise) return ytApiPromise;

  ytApiPromise = new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      if (window.YT) resolve(window.YT);
    };

    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      tag.async = true;
      document.head.appendChild(tag);
    }

    const poll = window.setInterval(() => {
      if (window.YT?.Player) {
        window.clearInterval(poll);
        resolve(window.YT);
      }
    }, 40);
  });

  return ytApiPromise;
}

function formatTime(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const s = Math.floor(sec % 60);
  const m = Math.floor(sec / 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Linha compacta estilo Spotify + timeline sincronizada (YouTube IFrame API).
 */
export function MusicTrackPlayer({
  track,
  className,
  defaultOpen = false,
}: {
  track: FavoriteTrack;
  className?: string;
  defaultOpen?: boolean;
}) {
  const [playing, setPlaying] = useState(defaultOpen);
  const [progress, setProgress] = useState(0); // 0–1
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [ready, setReady] = useState(false);
  /** 0–100, estilo YouTube API */
  const [volume, setVolume] = useState(80);
  const [muted, setMuted] = useState(false);
  const volumeRef = useRef(80);

  const playerRef = useRef<YTPlayer | null>(null);
  const pollRef = useRef<number | null>(null);
  const seekingRef = useRef(false);
  const [hostKey, setHostKey] = useState(0);
  const reactId = useId().replace(/:/g, "");
  const hostDomId = `yt-host-${track.id}-${reactId}`;

  const videoId = useMemo(
    () =>
      track.platform === "youtube"
        ? parseYoutubeId(track.url) || parseYoutubeId(track.embedUrl || "")
        : null,
    [track.platform, track.url, track.embedUrl]
  );

  const embedSrc = useMemo(() => {
    if (track.embedUrl) return track.embedUrl;
    return buildEmbedUrl(track.platform, track.url);
  }, [track.embedUrl, track.platform, track.url]);

  const stopPoll = useCallback(() => {
    if (pollRef.current != null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPoll = useCallback(() => {
    stopPoll();
    pollRef.current = window.setInterval(() => {
      const p = playerRef.current;
      if (!p || seekingRef.current) return;
      try {
        const t = p.getCurrentTime() || 0;
        const d = p.getDuration() || 0;
        setCurrent(t);
        setDuration(d);
        if (d > 0) setProgress(Math.min(1, Math.max(0, t / d)));
      } catch {
        /* player not ready */
      }
    }, 200);
  }, [stopPoll]);

  const destroyPlayer = useCallback(() => {
    stopPoll();
    try {
      playerRef.current?.destroy();
    } catch {
      /* ignore */
    }
    playerRef.current = null;
    setReady(false);
    setProgress(0);
    setCurrent(0);
    setDuration(0);
    // remonta o host (YT substitui o div por iframe)
    setHostKey((k) => k + 1);
  }, [stopPoll]);

  // YouTube: cria / destrói player
  useEffect(() => {
    if (track.platform !== "youtube" || !videoId) return;

    let cancelled = false;

    if (!playing) {
      // pausa sem destruir se já existe (toggle rápido)
      try {
        playerRef.current?.pauseVideo();
      } catch {
        /* ignore */
      }
      stopPoll();
      return;
    }

    (async () => {
      const YT = await loadYouTubeApi();
      if (cancelled) return;

      // reutiliza player
      if (playerRef.current) {
        try {
          playerRef.current.playVideo();
          startPoll();
          return;
        } catch {
          destroyPlayer();
        }
      }

      const host = document.getElementById(hostDomId);
      if (!host) return;

      playerRef.current = new YT.Player(hostDomId, {
        height: "1",
        width: "1",
        videoId,
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          origin:
            typeof window !== "undefined" ? window.location.origin : undefined,
        },
        events: {
          onReady: (e: { target: YTPlayer }) => {
            if (cancelled) return;
            setReady(true);
            try {
              e.target.setVolume(volumeRef.current);
              if (muted) e.target.mute();
              else e.target.unMute();
              e.target.playVideo();
              const d = e.target.getDuration() || 0;
              setDuration(d);
            } catch {
              /* ignore */
            }
            startPoll();
          },
          onStateChange: (e: { data: number; target: YTPlayer }) => {
            if (cancelled) return;
            const S = YT.PlayerState;
            if (e.data === S.PLAYING) {
              setPlaying(true);
              startPoll();
            } else if (e.data === S.PAUSED) {
              stopPoll();
            } else if (e.data === S.ENDED) {
              stopPoll();
              setPlaying(false);
              setProgress(0);
              setCurrent(0);
              try {
                e.target.seekTo(0, true);
              } catch {
                /* ignore */
              }
            }
          },
        },
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [
    playing,
    track.platform,
    videoId,
    hostDomId,
    startPoll,
    stopPoll,
    destroyPlayer,
  ]);

  // cleanup unmount
  useEffect(() => {
    return () => destroyPlayer();
  }, [destroyPlayer]);

  // um player por vez
  useEffect(() => {
    if (!playing) return;
    window.dispatchEvent(
      new CustomEvent("nullysh:music-play", { detail: { id: track.id } })
    );
    function onOther(e: Event) {
      const id = (e as CustomEvent<{ id: string }>).detail?.id;
      if (id && id !== track.id) {
        setPlaying(false);
        try {
          playerRef.current?.pauseVideo();
        } catch {
          /* ignore */
        }
        stopPoll();
      }
    }
    window.addEventListener("nullysh:music-play", onOther);
    return () => window.removeEventListener("nullysh:music-play", onOther);
  }, [playing, track.id, stopPoll]);

  const title =
    track.title?.trim() &&
    !/^youtube\s*[·•-]\s*track$/i.test(track.title.trim())
      ? track.title.trim()
      : "Faixa";
  const artist =
    track.artist?.trim() || musicPlatformLabel(track.platform);

  function toggle() {
    if (track.platform === "youtube" && videoId) {
      if (playing) {
        try {
          playerRef.current?.pauseVideo();
        } catch {
          /* ignore */
        }
        stopPoll();
        setPlaying(false);
      } else {
        setPlaying(true);
      }
      return;
    }

    if (!embedSrc) {
      window.open(normalizeUrl(track.url), "_blank", "noopener,noreferrer");
      return;
    }
    setPlaying((p) => !p);
  }

  function onSeek(e: { currentTarget: HTMLDivElement; clientX: number }) {
    if (track.platform !== "youtube" || !playerRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(
      1,
      Math.max(0, (e.clientX - rect.left) / rect.width)
    );
    const t = ratio * duration;
    seekingRef.current = true;
    setProgress(ratio);
    setCurrent(t);
    try {
      playerRef.current.seekTo(t, true);
      if (!playing) {
        playerRef.current.playVideo();
        setPlaying(true);
      }
    } catch {
      /* ignore */
    }
    window.setTimeout(() => {
      seekingRef.current = false;
    }, 120);
  }

  function applyVolume(vol: number) {
    const v = Math.min(100, Math.max(0, Math.round(vol)));
    volumeRef.current = v;
    setVolume(v);
    try {
      playerRef.current?.setVolume(v);
      if (v === 0) {
        playerRef.current?.mute();
        setMuted(true);
      } else if (muted) {
        playerRef.current?.unMute();
        setMuted(false);
      }
    } catch {
      /* ignore */
    }
  }

  function toggleMute() {
    try {
      if (muted || volume === 0) {
        playerRef.current?.unMute();
        const restore = volumeRef.current > 0 ? volumeRef.current : 80;
        playerRef.current?.setVolume(restore);
        setVolume(restore);
        volumeRef.current = restore;
        setMuted(false);
      } else {
        playerRef.current?.mute();
        setMuted(true);
      }
    } catch {
      setMuted((m) => !m);
    }
  }

  const spotifySrc = useMemo(() => {
    if (!playing || track.platform !== "spotify" || !embedSrc) return null;
    return embedSrc;
  }, [playing, track.platform, embedSrc]);

  const scSrc = useMemo(() => {
    if (!playing || track.platform !== "soundcloud" || !embedSrc) return null;
    try {
      const u = new URL(embedSrc);
      u.searchParams.set("auto_play", "true");
      return u.toString();
    } catch {
      return embedSrc;
    }
  }, [playing, track.platform, embedSrc]);

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl",
        "border border-neutral-200/90 bg-[#121212] text-white",
        "shadow-[0_1px_2px_rgb(0_0_0/0.06)]",
        "dark:border-zinc-800",
        className
      )}
    >
      {/* Host oculto do YT Player API */}
      {track.platform === "youtube" && videoId && (
        <div
          className="pointer-events-none absolute h-px w-px overflow-hidden opacity-0"
          aria-hidden
        >
          <div key={hostKey} id={hostDomId} />
        </div>
      )}

      <div className="flex items-center gap-3 px-2.5 py-2 sm:px-3">
        {/* Capa + play */}
        <button
          type="button"
          onClick={toggle}
          className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md bg-white/10 ring-1 ring-white/10"
          aria-label={playing ? `Pausar ${title}` : `Tocar ${title}`}
          title={playing ? "Pausar" : "Tocar no fórum"}
        >
          {track.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={track.thumbnailUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center">
              <MusicPlatformIcon platform={track.platform} size={20} />
            </span>
          )}
          <span
            className={cn(
              "absolute inset-0 flex items-center justify-center transition",
              playing ? "bg-black/45" : "bg-black/35 group-hover:bg-black/50"
            )}
          >
            {playing ? (
              <Pause size={16} weight="fill" className="text-white drop-shadow" />
            ) : (
              <Play
                size={16}
                weight="fill"
                className="ml-0.5 text-white drop-shadow"
              />
            )}
          </span>
        </button>

        <button
          type="button"
          onClick={toggle}
          className="min-w-0 flex-1 text-left"
        >
          <span className="block truncate text-[13px] font-semibold tracking-tight text-white">
            {title}
          </span>
          <span className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-white/55">
            <MusicPlatformIcon platform={track.platform} size={12} />
            <span className="truncate">{artist}</span>
          </span>
        </button>

      </div>

      {/* Timeline + volume (YouTube) */}
      {track.platform === "youtube" && (playing || progress > 0) && (
        <div className="border-t border-white/10 px-3 py-2">
          <div
            role="slider"
            aria-valuemin={0}
            aria-valuemax={Math.floor(duration) || 0}
            aria-valuenow={Math.floor(current)}
            aria-label="Posição da música"
            tabIndex={0}
            onClick={onSeek}
            className="relative flex h-1.5 cursor-pointer items-center rounded-full bg-white/15"
          >
            <span
              className="absolute inset-y-0 left-0 rounded-full bg-white transition-[width] duration-100 ease-linear"
              style={{ width: `${progress * 100}%` }}
            />
            <span
              className="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-white shadow"
              style={{ left: `calc(${progress * 100}% - 5px)` }}
            />
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="w-8 shrink-0 text-[10px] tabular-nums text-white/40">
              {formatTime(current)}
            </span>

            <div className="ml-auto flex min-w-0 items-center gap-1.5">
              <button
                type="button"
                onClick={toggleMute}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white"
                aria-label={muted || volume === 0 ? "Ativar som" : "Mudo"}
                title={muted || volume === 0 ? "Ativar som" : "Mudo"}
              >
                {muted || volume === 0 ? (
                  <SpeakerSlash size={14} weight="fill" />
                ) : (
                  <SpeakerHigh size={14} weight="fill" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={muted ? 0 : volume}
                onChange={(e) => applyVolume(Number(e.target.value))}
                aria-label="Volume"
                className={cn(
                  "h-1 w-16 cursor-pointer appearance-none rounded-full sm:w-20",
                  "bg-white/15 accent-white",
                  "[&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:w-2.5",
                  "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full",
                  "[&::-webkit-slider-thumb]:bg-white"
                )}
              />
            </div>

            <span className="w-8 shrink-0 text-right text-[10px] tabular-nums text-white/40">
              {ready || duration > 0 ? formatTime(duration) : "—:——"}
            </span>
          </div>
        </div>
      )}

      {/* Spotify / SoundCloud: player oficial compacto (já traz timeline própria) */}
      {spotifySrc && (
        <div className="border-t border-white/10 px-2 pb-2 pt-1.5">
          <iframe
            title={`${title} — ${artist}`}
            src={spotifySrc}
            width="100%"
            height={80}
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="eager"
            className="w-full rounded-lg border-0"
          />
        </div>
      )}

      {scSrc && (
        <div className="border-t border-white/10 px-2 pb-2 pt-1.5">
          <iframe
            title={`${title} — ${artist}`}
            src={scSrc}
            width="100%"
            height={80}
            allow="autoplay"
            loading="eager"
            className="w-full rounded-lg border-0"
          />
        </div>
      )}
    </div>
  );
}
