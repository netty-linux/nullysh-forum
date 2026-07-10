"use client";

import { useAuthStore } from "@/lib/auth-store";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { UserPublic } from "@/lib/types";
import { useEffect, useMemo } from "react";

/**
 * Hook de auth — deriva o user do store sem setState em effect.
 *
 * Antes: getCurrentUser() + setUser no effect gerava objeto novo a cada
 * chamada → "Maximum update depth exceeded" / getSnapshot loop (React 19).
 *
 * - Supabase: SupabaseAuthBridge define hydrated após INITIAL_SESSION
 * - Local: onFinishHydration do zustand persist
 */
export function useAuth() {
  const hydrated = useAuthStore((s) => s.hydrated);
  const setHydrated = useAuthStore((s) => s.setHydrated);
  const currentUserId = useAuthStore((s) => s.currentUserId);
  const users = useAuthStore((s) => s.users);

  useEffect(() => {
    if (isSupabaseConfigured()) return;

    if (useAuthStore.persist.hasHydrated()) {
      // só grava se ainda false — evita notify desnecessário
      if (!useAuthStore.getState().hydrated) {
        setHydrated(true);
      }
    }
    const unsub = useAuthStore.persist.onFinishHydration(() => {
      if (!useAuthStore.getState().hydrated) {
        setHydrated(true);
      }
    });
    return unsub;
  }, [setHydrated]);

  const user = useMemo((): UserPublic | null => {
    if (!currentUserId) return null;
    const raw = users.find((u) => u.id === currentUserId);
    if (!raw) return null;
    // Remove password sem re-normalizar (evita objeto "novo" a toa no store)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _pw, ...rest } = raw;
    return rest as UserPublic;
  }, [currentUserId, users]);

  return {
    user,
    isAuthenticated: !!user,
    isVip: !!user?.isVip,
    hydrated,
  };
}
