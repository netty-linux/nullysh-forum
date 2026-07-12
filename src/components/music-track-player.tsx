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
import { Pause, Play } from "@phosphor-icons/react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

/* ─── YouTube IFrame API (progresso real) ─── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type YTPlayer = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type YTNamespace = any;

let ytApiPromise: Promise<YTNamespace> | null = null;

function loadYouTubeApi(): Promise<YTNamespace> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("no window"));
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  if (w.YT?.Player) {
    return Promise.resolve(w.YT);
  }
  if (ytApiPromise) return ytApiPromise;

  ytApiPromise = new Promise((resolve) => {
    const prev = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      prev?.();
      if (w.YT) resolve(w.YT);
    };

    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      tag.async = true;
      document.head.appendChild(tag);
    }

    const poll = window.setInterval(() => {
      if (w.YT?.Player) {
        window.clearInterval(poll);
        resolve(w.YT);
      }
    }, 40);
  });

  return ytApiPromise;
}

/**
 * Linha compacta estilo Spotify (capa + play/pause + título).
 * Sem timeline nem knob de volume no perfil.
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

  const playerRef = useRef<YTPlayer | null>(null);
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

  const destroyPlayer = useCallback(() => {
    try {
      playerRef.current?.destroy();
    } catch {
      /* ignore */
    }
    playerRef.current = null;
    // remonta o host (YT substitui o div por iframe)
    setHostKey((k) => k + 1);
  }, []);

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
      return;
    }

    (async () => {
      const YT = await loadYouTubeApi();
      if (cancelled) return;

      // reutiliza player
      if (playerRef.current) {
        try {
          playerRef.current.playVideo();
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
            try {
              e.target.setVolume(80);
              e.target.unMute();
              e.target.playVideo();
            } catch {
              /* ignore */
            }
          },
          onStateChange: (e: { data: number; target: YTPlayer }) => {
            if (cancelled) return;
            const S = YT.PlayerState;
            if (e.data === S.PLAYING) {
              setPlaying(true);
            } else if (e.data === S.ENDED) {
              setPlaying(false);
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
  }, [playing, track.platform, videoId, hostDomId, destroyPlayer]);

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
      }
    }
    window.addEventListener("nullysh:music-play", onOther);
    return () => window.removeEventListener("nullysh:music-play", onOther);
  }, [playing, track.id]);

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

      {/* Spotify / SoundCloud: player oficial compacto */}
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
