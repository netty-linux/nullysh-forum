"use client";

import { useAuthStore } from "@/lib/auth-store";
import { useEffect, useState } from "react";

export function useAuth() {
  const hydrated = useAuthStore((s) => s.hydrated);
  const setHydrated = useAuthStore((s) => s.setHydrated);
  const currentUserId = useAuthStore((s) => s.currentUserId);
  const getCurrentUser = useAuthStore((s) => s.getCurrentUser);
  const users = useAuthStore((s) => s.users);
  const [user, setUser] = useState(getCurrentUser());

  useEffect(() => {
    const finish = () => setHydrated(true);
    finish();
    const unsub = useAuthStore.persist.onFinishHydration(finish);
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
