/**
 * Compressão e helpers de mídia do bate-papo (cliente).
 * Imagens → canvas JPEG; vídeos → re-encode leve via canvas frames N/A,
 * então limite + opcional compress com bitrate baixo se File pequeno.
 */

export const CHAT_MAX_IMAGE_UPLOAD = 12 * 1024 * 1024; // 12 MB original
export const CHAT_MAX_VIDEO_UPLOAD = 40 * 1024 * 1024; // 40 MB original
export const CHAT_MAX_AUDIO_UPLOAD = 8 * 1024 * 1024; // 8 MB
export const CHAT_IMAGE_TARGET = 450 * 1024; // ~450 KB
export const CHAT_VIDEO_TARGET = 8 * 1024 * 1024; // 8 MB alvo

function loadImage(file: File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Falha ao ler imagem"));
    };
    img.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob falhou"))),
      type,
      quality
    );
  });
}

export async function compressChatImage(file: File): Promise<{
  blob: Blob;
  dataUrl: string;
  width: number;
  height: number;
}> {
  if (file.size > CHAT_MAX_IMAGE_UPLOAD) {
    throw new Error("Imagem maior que 12 MB. Escolha outra.");
  }
  const img = await loadImage(file);
  const maxSide = 1440;
  let { width, height } = img;
  const scale = Math.min(1, maxSide / Math.max(width, height));
  width = Math.max(1, Math.round(width * scale));
  height = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível");
  ctx.drawImage(img, 0, 0, width, height);

  let quality = 0.85;
  let blob = await canvasToBlob(canvas, "image/jpeg", quality);
  while (blob.size > CHAT_IMAGE_TARGET && quality > 0.45) {
    quality -= 0.08;
    blob = await canvasToBlob(canvas, "image/jpeg", quality);
  }

  const dataUrl = await blobToDataUrl(blob);
  return { blob, dataUrl, width, height };
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("FileReader falhou"));
    r.readAsDataURL(blob);
  });
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

/** Vídeo: se já cabe no alvo, mantém; senão tenta reduzir via re-mux simples (aceita se < max). */
export async function prepareChatVideo(file: File): Promise<{
  blob: Blob;
  dataUrl: string;
  mime: string;
  duration: number;
  thumbDataUrl: string | null;
}> {
  if (!file.type.startsWith("video/")) {
    throw new Error("Arquivo não é vídeo.");
  }
  if (file.size > CHAT_MAX_VIDEO_UPLOAD) {
    throw new Error("Vídeo maior que 40 MB. Compacte ou envie um trecho menor.");
  }

  const duration = await probeVideoDuration(file);
  const thumbDataUrl = await captureVideoThumb(file);

  // Se já está ok, envia como está
  if (file.size <= CHAT_VIDEO_TARGET) {
    const dataUrl = await blobToDataUrl(file);
    return {
      blob: file,
      dataUrl,
      mime: file.type || "video/mp4",
      duration,
      thumbDataUrl,
    };
  }

  // Tenta re-gravar com bitrate baixo via canvas + MediaRecorder (quando o browser permitir)
  try {
    const recompressed = await recompressVideoBrowser(file, duration);
    if (recompressed && recompressed.size <= CHAT_VIDEO_TARGET * 1.15) {
      const dataUrl = await blobToDataUrl(recompressed);
      return {
        blob: recompressed,
        dataUrl,
        mime: recompressed.type || "video/webm",
        duration,
        thumbDataUrl,
      };
    }
  } catch {
    /* fallback */
  }

  if (file.size > CHAT_VIDEO_TARGET * 1.5) {
    throw new Error(
      `Vídeo com ${(file.size / (1024 * 1024)).toFixed(1)} MB. Tente um arquivo até ~8 MB ou mais curto.`
    );
  }

  const dataUrl = await blobToDataUrl(file);
  return {
    blob: file,
    dataUrl,
    mime: file.type || "video/mp4",
    duration,
    thumbDataUrl,
  };
}

function probeVideoDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      const d = Number.isFinite(v.duration) ? v.duration : 0;
      URL.revokeObjectURL(url);
      resolve(d);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(0);
    };
    v.src = url;
  });
}

function captureVideoThumb(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "auto";
    v.muted = true;
    v.playsInline = true;
    v.onloadeddata = () => {
      try {
        v.currentTime = Math.min(0.3, (v.duration || 1) * 0.1);
      } catch {
        /* ignore */
      }
    };
    v.onseeked = () => {
      try {
        const maxW = 480;
        const scale = Math.min(1, maxW / (v.videoWidth || maxW));
        const w = Math.max(1, Math.round((v.videoWidth || 320) * scale));
        const h = Math.max(1, Math.round((v.videoHeight || 180) * scale));
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        c.getContext("2d")?.drawImage(v, 0, 0, w, h);
        const data = c.toDataURL("image/jpeg", 0.75);
        URL.revokeObjectURL(url);
        resolve(data);
      } catch {
        URL.revokeObjectURL(url);
        resolve(null);
      }
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    v.src = url;
  });
}

async function recompressVideoBrowser(
  file: File,
  _duration: number
): Promise<Blob | null> {
  // Abordagem: draw frames do vídeo em canvas e gravar com MediaRecorder
  // (funciona bem em Chrome; pode falhar em Safari — retorna null).
  if (typeof MediaRecorder === "undefined") return null;

  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.src = url;
  video.muted = true;
  video.playsInline = true;
  await new Promise<void>((res, rej) => {
    video.onloadedmetadata = () => res();
    video.onerror = () => rej(new Error("video meta"));
  });

  const maxW = 720;
  const scale = Math.min(1, maxW / (video.videoWidth || maxW));
  const w = Math.max(2, Math.round((video.videoWidth || 640) * scale) & ~1);
  const h = Math.max(2, Math.round((video.videoHeight || 360) * scale) & ~1);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    URL.revokeObjectURL(url);
    return null;
  }

  const stream = canvas.captureStream(24);
  // tenta copiar áudio original
  try {
    const vStream = (video as HTMLVideoElement & {
      captureStream?: () => MediaStream;
      mozCaptureStream?: () => MediaStream;
    }).captureStream?.() ||
      (video as HTMLVideoElement & { mozCaptureStream?: () => MediaStream })
        .mozCaptureStream?.();
    const audioTracks = vStream?.getAudioTracks() || [];
    for (const t of audioTracks) stream.addTrack(t);
  } catch {
    /* sem áudio */
  }

  const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
    ? "video/webm;codecs=vp9"
    : MediaRecorder.isTypeSupported("video/webm;codecs=vp8")
      ? "video/webm;codecs=vp8"
      : "video/webm";

  const chunks: Blob[] = [];
  const rec = new MediaRecorder(stream, {
    mimeType: mime,
    videoBitsPerSecond: 900_000,
  });
  rec.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };

  const done = new Promise<Blob>((resolve) => {
    rec.onstop = () => {
      resolve(new Blob(chunks, { type: mime }));
    };
  });

  rec.start(200);
  await video.play();

  const draw = () => {
    if (video.ended || video.paused) return;
    ctx.drawImage(video, 0, 0, w, h);
    requestAnimationFrame(draw);
  };
  draw();

  await new Promise<void>((resolve) => {
    video.onended = () => resolve();
    // safety timeout 3 min
    window.setTimeout(() => resolve(), 180_000);
  });

  if (rec.state !== "inactive") rec.stop();
  video.pause();
  URL.revokeObjectURL(url);
  const out = await done;
  return out.size > 0 ? out : null;
}

export async function prepareChatAudio(blob: Blob): Promise<{
  dataUrl: string;
  mime: string;
  duration: number;
}> {
  if (blob.size > CHAT_MAX_AUDIO_UPLOAD) {
    throw new Error("Áudio muito longo. Grave um trecho menor.");
  }
  const duration = await probeAudioDuration(blob);
  const dataUrl = await blobToDataUrl(blob);
  return {
    dataUrl,
    mime: blob.type || "audio/webm",
    duration,
  };
}

function probeAudioDuration(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("audio");
    a.preload = "metadata";
    a.onloadedmetadata = () => {
      const d = Number.isFinite(a.duration) ? a.duration : 0;
      URL.revokeObjectURL(url);
      resolve(d);
    };
    a.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(0);
    };
    a.src = url;
  });
}

export function formatMediaDuration(sec: number): string {
  if (!sec || !Number.isFinite(sec)) return "0:00";
  const s = Math.floor(sec % 60);
  const m = Math.floor(sec / 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
