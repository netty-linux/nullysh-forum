/**
 * Controlador global de música do feed (estilo Instagram).
 * Apenas o post com melhor score (visibilidade + proximidade do centro) toca.
 */

export type PostMusicHandlers = {
  play: () => void;
  pause: () => void;
};

type Entry = {
  score: number;
  handlers: PostMusicHandlers;
};

const entries = new Map<string, Entry>();
let activeId: string | null = null;
let unlocked = false;

/** Desbloqueia autoplay com som após primeira interação do usuário */
export function unlockPostMusicAudio() {
  unlocked = true;
}

export function isPostMusicAudioUnlocked() {
  return unlocked;
}

export function getActivePostMusicId() {
  return activeId;
}

/**
 * Atualiza candidatura. score <= 0 remove o post da disputa.
 * score maior = mais “centralizado” / visível.
 */
export function reportPostMusicVisibility(
  postId: string,
  score: number,
  handlers: PostMusicHandlers
) {
  if (score <= 0) {
    entries.delete(postId);
  } else {
    entries.set(postId, { score, handlers });
  }
  elect();
}

export function unregisterPostMusic(postId: string) {
  entries.delete(postId);
  if (activeId === postId) {
    activeId = null;
  }
  elect();
}

function elect() {
  let bestId: string | null = null;
  let bestScore = 0;

  for (const [id, e] of entries) {
    if (e.score > bestScore) {
      bestScore = e.score;
      bestId = id;
    }
  }

  // Threshold mínimo (evita tocar posts só 5% na tela)
  if (bestScore < 0.35) {
    bestId = null;
  }

  if (bestId === activeId) return;

  // Pausa o anterior
  if (activeId) {
    const prev = entries.get(activeId);
    try {
      prev?.handlers.pause();
    } catch {
      /* ignore */
    }
  }

  activeId = bestId;

  if (activeId) {
    const next = entries.get(activeId);
    try {
      next?.handlers.play();
    } catch {
      /* ignore */
    }
  }
}

/** Tab oculta → pausa tudo */
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && activeId) {
      const cur = entries.get(activeId);
      try {
        cur?.handlers.pause();
      } catch {
        /* ignore */
      }
      // não zera activeId — ao voltar, elect reavalia
    } else if (document.visibilityState === "visible") {
      elect();
    }
  });

  // Primeiro toque/scroll desbloqueia áudio (política do browser)
  const unlock = () => {
    unlockPostMusicAudio();
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
    window.removeEventListener("touchstart", unlock);
  };
  window.addEventListener("pointerdown", unlock, { once: true, passive: true });
  window.addEventListener("keydown", unlock, { once: true });
  window.addEventListener("touchstart", unlock, { once: true, passive: true });
}
