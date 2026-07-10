import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatDate(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

export function formatRelative(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return formatDate(iso);
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

export function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

/** Handle público (@username) — 3–24 chars, a-z 0-9 _ */
const USERNAME_RE = /^[a-z0-9_]{3,24}$/;
const RESERVED_USERNAMES = new Set([
  "admin",
  "administrator",
  "nullysh",
  "nullain",
  "support",
  "suporte",
  "mod",
  "moderador",
  "root",
  "system",
  "api",
  "help",
  "me",
  "perfil",
  "profile",
  "settings",
  "login",
  "register",
  "vip",
]);

/** Normaliza input de @ (remove @, espaços, lower) */
export function normalizeUsername(raw: string): string {
  return raw
    .trim()
    .replace(/^@+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
}

export function isValidUsername(raw: string): boolean {
  const u = normalizeUsername(raw);
  if (!USERNAME_RE.test(u)) return false;
  if (RESERVED_USERNAMES.has(u)) return false;
  return true;
}

export function usernameValidationError(raw: string): string | null {
  const u = normalizeUsername(raw);
  if (u.length < 3) return "O @ precisa ter no mínimo 3 caracteres.";
  if (u.length > 24) return "O @ pode ter no máximo 24 caracteres.";
  if (!/^[a-z0-9_]+$/.test(u)) {
    return "Use só letras minúsculas, números e underscore (_).";
  }
  if (RESERVED_USERNAMES.has(u)) return "Este @ está reservado.";
  return null;
}

/** Gera @ a partir do e-mail (parte local) — fallback se vazio */
export function suggestUsernameFromEmail(email: string): string {
  let local = (email.split("@")[0] || "user")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 24);
  if (local.length < 3) local = (local + "user").slice(0, 24);
  // Se cair em reservado, prefixa "u_"
  if (RESERVED_USERNAMES.has(local) || !/^[a-z0-9_]{3,24}$/.test(local)) {
    local = `u_${local}`.replace(/[^a-z0-9_]/g, "").slice(0, 24);
  }
  if (local.length >= 3 && /^[a-z0-9_]{3,24}$/.test(local) && !RESERVED_USERNAMES.has(local)) {
    return local;
  }
  return `user_${uid("").slice(-6)}`;
}

export function displayUsername(
  user: { username?: string | null; email?: string } | null | undefined
): string {
  if (!user) return "user";
  if (user.username && user.username.trim()) {
    return normalizeUsername(user.username);
  }
  if (user.email) return suggestUsernameFromEmail(user.email);
  return "user";
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/** Normaliza URL para href seguro (adiciona https se faltar). */
export function normalizeUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

export function isValidUrl(raw: string): boolean {
  try {
    const u = new URL(normalizeUrl(raw));
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Domínio amigável para exibir quando não há label. */
export function displayHost(url: string): string {
  try {
    return new URL(normalizeUrl(url)).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
