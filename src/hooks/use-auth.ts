"use client";

import { useAuthStore } from "@/lib/auth-store";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { useEffect, useState } from "react";

/**
 * Hook de auth.
 *
 * NÃO marca hydrated=true no mount — isso causava logout fantasma:
 * currentUserId ainda null (rehydrate async) + hydrated true → AuthGuard
 * redirecionava para /login a cada reload.
 *
 * - Supabase: SupabaseAuthBridge define hydrated após INITIAL_SESSION
 * - Local: onFinishHydration do zustand persist
 */
export function useAuth() {
  const hydrated = useAuthStore((s) => s.hydrated);
  const setHydrated = useAuthStore((s) => s.setHydrated);
  const currentUserId = useAuthStore((s) => s.currentUserId);
  const getCurrentUser = useAuthStore((s) => s.getCurrentUser);
  const users = useAuthStore((s) => s.users);
  const [user, setUser] = useState(getCurrentUser());

  useEffect(() => {
    // Com Supabase, a bridge controla hydrated (sessão real).
    if (isSupabaseConfigured()) return;

    const mark = () => setHydrated(true);

    if (useAuthStore.persist.hasHydrated()) {
      mark();
    }
    const unsub = useAuthStore.persist.onFinishHydration(mark);
    return unsub;
  }, [setHydrated]);

  useEffect(() => {
    setUser(getCurrentUser());
  }, [currentUserId, getCurrentUser, hydrated, users]);

  return {
    user,
    isAuthenticated: !!user,
    isVip: !!user?.isVip,
    hydrated,
  };
}
