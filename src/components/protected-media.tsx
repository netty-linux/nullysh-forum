"use client";

import { cn } from "@/lib/utils";
import { Lock } from "@phosphor-icons/react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

type Props = {
  src: string;
  alt?: string;
  className?: string;
  /**
   * true = bloqueia truques de download (clique direito, arrastar, abrir em guia).
   * false = <img> normal (ex.: VIP com permissão de download).
   */
  protect?: boolean;
  /**
   * Conteúdo VIP bloqueado: NÃO carrega a mídia real no DOM
   * (evita “abrir imagem em nova guia” / Network tab com URL útil).
   */
  locked?: boolean;
  /** Overlay extra (botão Baixar, etc.) — fica acima do escudo */
  children?: ReactNode;
};

function blockEvent(e: {
  preventDefault: () => void;
  stopPropagation: () => void;
}) {
  e.preventDefault();
  e.stopPropagation();
}

/**
 * Mídia de feed com anti-bypass de download (MVP client-side).
 *
 * Free / sem permissão:
 *  - render em canvas (sem <img src> clicável)
 *  - overlay transparente captura clique direito
 *  - bloqueia drag, seleção e atalhos comuns
 *
 * VIP locked (conteúdo exclusivo):
 *  - placeholder sem carregar a URL real
 *
 * Nota: proteção total só existe com URLs assinadas no servidor.
 * Isto fecha os atalhos do dia a dia (menu do browser, drag, nova guia).
 */
export function ProtectedMedia({
  src,
  alt = "",
  className,
  protect = true,
  locked = false,
  children,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  const paint = useCallback(() => {
    if (!protect || locked || !src || !canvasRef.current || !boxRef.current) {
      return;
    }
    const canvas = canvasRef.current;
    const box = boxRef.current;
    const img = new Image();
    // data: e blob: não usam CORS; https pode falhar se o host não liberar
    if (!src.startsWith("data:") && !src.startsWith("blob:")) {
      img.crossOrigin = "anonymous";
    }

    img.onload = () => {
      const maxW = box.clientWidth || 640;
      const maxH = Math.min(480, Math.round(window.innerHeight * 0.7));
      const nw = img.naturalWidth || 1;
      const nh = img.naturalHeight || 1;
      const scale = Math.min(1, maxW / nw, maxH / nh);
      const w = Math.max(1, Math.round(nw * scale));
      const h = Math.max(1, Math.round(nh * scale));
      const dpr = Math.min(2, window.devicePixelRatio || 1);

      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      setFailed(false);
    };

    img.onerror = () => {
      // Fallback visual sem expor <img> salvável: background no container
      setFailed(true);
    };

    img.src = src;
  }, [src, protect, locked]);

  useEffect(() => {
    paint();
    if (!protect || locked) return;
    const ro = new ResizeObserver(() => paint());
    if (boxRef.current) ro.observe(boxRef.current);
    return () => ro.disconnect();
  }, [paint, protect, locked]);

  // Bloqueia atalhos comuns enquanto o ponteiro está sobre a mídia
  useEffect(() => {
    if (!protect && !locked) return;
    const el = boxRef.current;
    if (!el) return;

    function onKey(e: KeyboardEvent) {
      if (!boxRef.current) return;
      // Só se o foco/hover estiver na área (document.activeElement check fraco)
      const isMod = e.ctrlKey || e.metaKey;
      if (isMod && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
      }
    }

    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [protect, locked]);

  // ── Conteúdo VIP bloqueado: zero bytes da mídia real ──
  if (locked) {
    return (
      <div
        ref={boxRef}
        className={cn(
          "relative flex min-h-[200px] w-full items-center justify-center overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-200 dark:border-zinc-700 dark:bg-zinc-800",
          className
        )}
        onContextMenu={blockEvent}
        onDragStart={blockEvent}
      >
        <div className="flex flex-col items-center gap-2 p-8 text-neutral-400">
          <Lock size={28} weight="bold" aria-hidden />
          <span className="text-[12px] font-medium">Mídia exclusiva VIP</span>
        </div>
        {children}
      </div>
    );
  }

  // ── VIP com permissão: <img> normal + download oficial ──
  if (!protect) {
    return (
      <div
        ref={boxRef}
        className={cn("relative overflow-hidden", className)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="max-h-[min(480px,70vh)] w-full object-contain object-center"
        />
        {children ? (
          <div className="absolute bottom-2 right-2 z-10">{children}</div>
        ) : null}
      </div>
    );
  }

  // ── Free / sem download: canvas + escudo ──
  const fallbackStyle: CSSProperties | undefined = failed
    ? {
        backgroundImage: `url("${src.replace(/"/g, "%22")}")`,
        backgroundSize: "contain",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        minHeight: 200,
      }
    : undefined;

  return (
    <div
      ref={boxRef}
      className={cn(
        "relative select-none overflow-hidden",
        "[&_*]:select-none",
        className
      )}
      onContextMenu={blockEvent}
      onDragStart={blockEvent}
      onCopy={blockEvent}
      style={{ WebkitUserSelect: "none", userSelect: "none" }}
    >
      <div
        className="flex w-full items-center justify-center bg-neutral-100 dark:bg-zinc-900"
        style={fallbackStyle}
        role="img"
        aria-label={alt || "Mídia do post"}
      >
        {!failed && (
          <canvas
            ref={canvasRef}
            className="max-h-[min(480px,70vh)] max-w-full"
            // canvas ainda pode ter “salvar como” em alguns browsers — escudo cobre
          />
        )}
        {failed && <div className="min-h-[200px] w-full" aria-hidden />}
      </div>

      {/* Escudo: captura clique direito / long-press / arrastar */}
      <div
        className="absolute inset-0 z-[2] cursor-default"
        aria-hidden
        onContextMenu={blockEvent}
        onDragStart={blockEvent}
        onMouseDown={(e) => {
          // botão do meio / auxiliar
          if (e.button === 1 || e.button === 2) blockEvent(e);
        }}
        onAuxClick={blockEvent}
        style={{
          // impede seleção e drag no WebKit
          WebkitTouchCallout: "none",
          WebkitUserSelect: "none",
          userSelect: "none",
        }}
      />

      {/* Controles legítimos (Baixar VIP, etc.) acima do escudo */}
      {children ? (
        <div className="pointer-events-none absolute inset-0 z-[3]">
          <div className="pointer-events-auto absolute bottom-2 right-2">
            {children}
          </div>
        </div>
      ) : null}
    </div>
  );
}
