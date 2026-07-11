"use client";

import { cn } from "@/lib/utils";

type Props = {
  streamUrl: string;
  title?: string;
  className?: string;
  autoPlay?: boolean;
};

/**
 * Player HTML5 nativo — src aponta para stream R2 ou proxy `/api/videos/.../stream`.
 */
export function VideoPlayer({
  streamUrl,
  title,
  className,
  autoPlay = false,
}: Props) {
  return (
    <video
      className={cn("w-full rounded-lg", className)}
      controls
      playsInline
      preload="metadata"
      autoPlay={autoPlay}
      src={streamUrl}
      aria-label={title || "Vídeo"}
    >
      Seu navegador não suporta vídeo HTML5.
    </video>
  );
}
