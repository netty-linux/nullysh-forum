/**
 * Nullysh Panel (staff backoffice) — domínio e mapa de rotas.
 */

export const NULLYSH_PANEL_DEFAULT_URL = "https://panel.nullysh.com";

export function getNullyshPanelUrl(): string {
  const raw =
    (typeof process !== "undefined" &&
      process.env.NEXT_PUBLIC_NULLYSH_PANEL_URL?.trim()) ||
    "";
  return raw.replace(/\/+$/, "") || NULLYSH_PANEL_DEFAULT_URL;
}

/** Tabs legados do /app/admin → paths do Panel */
export const ADMIN_TAB_TO_PANEL: Record<string, string> = {
  pending: "/pending",
  history: "/history",
  users: "/members",
  members: "/members",
  nullpass: "/nullpass",
  "nullysh-pay": "/pay",
  pay: "/pay",
  trails: "/trails",
  events: "/events",
  materials: "/materials",
  videos: "/videos",
};

export function panelPathForAdminTab(tab: string | null | undefined): string {
  if (!tab) return "/";
  return ADMIN_TAB_TO_PANEL[tab] || "/";
}

export function panelUrlForAdminTab(tab?: string | null): string {
  return `${getNullyshPanelUrl()}${panelPathForAdminTab(tab)}`;
}
