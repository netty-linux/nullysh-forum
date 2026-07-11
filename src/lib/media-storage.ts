/**
 * Mídia pesada (avatar/banner data URLs e GIFs) em IndexedDB.
 * localStorage só guarda referências `idb:userId:avatar|banner` (~5–10MB de cota).
 */

const DB_NAME = "nullysh-media-v1";
const STORE = "blobs";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB indisponível"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error("IDB open failed"));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
  });
}

export function isDataUrl(v: string | null | undefined): boolean {
  return typeof v === "string" && v.startsWith("data:");
}

export function isMediaRef(v: string | null | undefined): boolean {
  return typeof v === "string" && v.startsWith("idb:");
}

export function mediaRef(userId: string, kind: "avatar" | "banner"): string {
  return `idb:${userId}:${kind}`;
}

/** Ref de mídia de mensagem do chat (áudio/imagem/vídeo) */
export function chatMediaRef(messageKey: string, part: "main" | "thumb" = "main"): string {
  return `idb:chat:${messageKey}:${part}`;
}

export async function mediaSet(key: string, value: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IDB write failed"));
    tx.objectStore(STORE).put(value, key);
  });
}

export async function mediaGet(key: string): Promise<string | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => {
        const v = req.result;
        resolve(typeof v === "string" ? v : null);
      };
      req.onerror = () => reject(req.error ?? new Error("IDB read failed"));
    });
  } catch {
    return null;
  }
}

export async function mediaDelete(key: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("IDB delete failed"));
      tx.objectStore(STORE).delete(key);
    });
  } catch {
    /* ignore */
  }
}

type UserMediaSlice = {
  id: string;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
};

/** data: → IndexedDB + ref idb: */
export async function offloadUserMedia<T extends UserMediaSlice>(
  users: T[]
): Promise<T[]> {
  const out: T[] = [];
  for (const u of users) {
    let avatarUrl = u.avatarUrl ?? null;
    let bannerUrl = u.bannerUrl ?? null;

    if (avatarUrl && isDataUrl(avatarUrl)) {
      const key = mediaRef(u.id, "avatar");
      try {
        await mediaSet(key, avatarUrl);
        avatarUrl = key;
      } catch {
        /* se IDB falhar, tenta não persistir o data URL */
        avatarUrl = null;
      }
    }

    if (bannerUrl && isDataUrl(bannerUrl)) {
      const key = mediaRef(u.id, "banner");
      try {
        await mediaSet(key, bannerUrl);
        bannerUrl = key;
      } catch {
        bannerUrl = null;
      }
    }

    // limpa refs órfãs se mídia foi removida
    if (avatarUrl === null) {
      await mediaDelete(mediaRef(u.id, "avatar"));
    }
    if (bannerUrl === null) {
      await mediaDelete(mediaRef(u.id, "banner"));
    }

    out.push({ ...u, avatarUrl, bannerUrl });
  }
  return out;
}

/** idb: → data: (ou mantém null) */
export async function hydrateUserMedia<T extends UserMediaSlice>(
  users: T[]
): Promise<T[]> {
  const out: T[] = [];
  for (const u of users) {
    let avatarUrl = u.avatarUrl ?? null;
    let bannerUrl = u.bannerUrl ?? null;

    if (avatarUrl && isMediaRef(avatarUrl)) {
      avatarUrl = (await mediaGet(avatarUrl)) ?? null;
    }
    if (bannerUrl && isMediaRef(bannerUrl)) {
      bannerUrl = (await mediaGet(bannerUrl)) ?? null;
    }

    out.push({ ...u, avatarUrl, bannerUrl });
  }
  return out;
}
