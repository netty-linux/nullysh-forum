/**
 * Contas / conteúdo de seed do MVP local.
 * Com Supabase ativo, esses IDs não devem aparecer no app.
 */

export const GHOST_USER_IDS = new Set([
  "admin",
  "demo",
  "u2",
  "u3",
  "u4",
]);

export const GHOST_EMAILS = new Set([
  "admin@nullysh.com",
  "demo@nullysh.com",
  "marina@nullysh.com",
  "rafael@nullysh.com",
  "ana@nullysh.com",
]);

/** Handles seed legados */
export const GHOST_USERNAMES = new Set([
  "nullysh",
  "demo",
  "marina",
  "rafael",
  "anabeatriz",
]);

export const GHOST_POST_IDS = new Set(["p1", "p2", "p3", "p4", "p5"]);
export const GHOST_COMMENT_IDS = new Set(["cm1"]);
export const GHOST_MESSAGE_IDS = new Set([
  "msg1",
  "msg2",
  "msg3",
  "msg4",
]);

export function isGhostUserId(id: string | null | undefined): boolean {
  if (!id) return false;
  return GHOST_USER_IDS.has(id);
}

export function isGhostUser(u: {
  id?: string;
  email?: string;
  username?: string;
}): boolean {
  if (u.id && GHOST_USER_IDS.has(u.id)) return true;
  const email = (u.email || "").trim().toLowerCase();
  if (email && GHOST_EMAILS.has(email)) return true;
  const username = (u.username || "").trim().toLowerCase();
  if (username && GHOST_USERNAMES.has(username) && u.id && GHOST_USER_IDS.has(u.id)) {
    return true;
  }
  return false;
}

export function isGhostPost(p: { id?: string; authorId?: string }): boolean {
  if (p.id && GHOST_POST_IDS.has(p.id)) return true;
  if (p.authorId && GHOST_USER_IDS.has(p.authorId)) return true;
  return false;
}

export function isGhostComment(c: {
  id?: string;
  authorId?: string;
  postId?: string;
}): boolean {
  if (c.id && GHOST_COMMENT_IDS.has(c.id)) return true;
  if (c.authorId && GHOST_USER_IDS.has(c.authorId)) return true;
  if (c.postId && GHOST_POST_IDS.has(c.postId)) return true;
  return false;
}

export function isGhostMessage(m: {
  id?: string;
  authorId?: string;
}): boolean {
  if (m.id && GHOST_MESSAGE_IDS.has(m.id)) return true;
  if (m.authorId && GHOST_USER_IDS.has(m.authorId)) return true;
  return false;
}
