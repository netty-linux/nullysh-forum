"use client";

import { useAuthStore } from "@/lib/auth-store";
import {
  fetchAllProfiles,
  fetchProfileById,
} from "@/lib/supabase/auth-service";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { UserPublic } from "@/lib/types";
import { useEffect, useRef } from "react";

/**
 * Sincroniza sessão Supabase → Zustand.
 *
 * Importante: a fonte de verdade da sessão é o Supabase (cookies/local),
 * NÃO o currentUserId do localStorage. Antes, um boot assíncrono +
 * `setHydrated(true)` precoce limpava o user e o AuthGuard mandava pro login
 * a cada reload/navegação.
 */
export function SupabaseAuthBridge({
  children,
}: {
  children: React.ReactNode;
}) {
  const setHydrated = useAuthStore((s) => s.setHydrated);
  const applyRemoteSession = useAuthStore((s) => s.applyRemoteSession);
  const syncing = useRef(false);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      // Modo local: hidratação fica a cargo do persist do zustand
      return;
    }

    const supabase = getSupabaseBrowser();
    if (!supabase) {
      setHydrated(true);
      return;
    }

    let mounted = true;

    async function syncFromSession(
      sessionUserId: string | null,
      event: string
    ) {
      if (!mounted) return;
      // Evita corridas entre INITIAL_SESSION / TOKEN_REFRESHED
      if (syncing.current && event === "TOKEN_REFRESHED") return;
      syncing.current = true;

      try {
        if (!sessionUserId) {
          // Só desloga de verdade — não por falha temporária de rede no profile
          let profiles: UserPublic[] = [];
          try {
            profiles = await fetchAllProfiles();
          } catch {
            profiles = [];
          }
          if (!mounted) return;
          applyRemoteSession({ currentUser: null, users: profiles });
          return;
        }

        let me: UserPublic | null = null;
        let profiles: UserPublic[] = [];
        try {
          [me, profiles] = await Promise.all([
            fetchProfileById(sessionUserId),
            fetchAllProfiles(),
          ]);
        } catch (e) {
          console.error("[supabase-bridge] falha ao carregar perfil", e);
          // NÃO limpa a sessão se o profile falhar (rede/RLS).
          // Mantém o userId no store se já existir; tenta só o profile.
          try {
            me = await fetchProfileById(sessionUserId);
          } catch {
            /* ignore */
          }
          if (me && mounted) {
            applyRemoteSession({
              currentUser: me,
              users: [me],
            });
          }
          return;
        }

        if (!mounted) return;

        if (!me) {
          // Sessão Auth ok mas profile ainda não existe — não ejetar.
          console.warn(
            "[supabase-bridge] profile ausente para",
            sessionUserId
          );
          useAuthStore.setState({
            remoteMode: true,
            currentUserId: sessionUserId,
          });
          return;
        }

        applyRemoteSession({
          currentUser: me,
          users: profiles.length ? profiles : [me],
        });
      } finally {
        syncing.current = false;
        if (mounted) setHydrated(true);
      }
    }

    // onAuthStateChange dispara INITIAL_SESSION com a sessão restaurada.
    // É o caminho oficial e evita race com getSession() cedo demais.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      // Eventos que não devem alterar login
      if (
        event === "PASSWORD_RECOVERY" ||
        event === "MFA_CHALLENGE_VERIFIED"
      ) {
        return;
      }

      if (event === "SIGNED_OUT") {
        void syncFromSession(null, event);
        return;
      }

      // INITIAL_SESSION | SIGNED_IN | TOKEN_REFRESHED | USER_UPDATED
      const uid = session?.user?.id ?? null;
      if (event === "INITIAL_SESSION" || event === "SIGNED_IN") {
        void syncFromSession(uid, event);
        return;
      }

      if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        // Só atualiza se ainda houver sessão — nunca zera no refresh
        if (uid) void syncFromSession(uid, event);
        return;
      }

      // Fallback: se veio sessão, sincroniza
      if (uid) void syncFromSession(uid, event);
    });

    // Safety: se por algum motivo INITIAL_SESSION não vier em 4s, libera a UI
    // sem forçar logout (consulta a sessão atual).
    const safety = window.setTimeout(() => {
      if (!mounted) return;
      if (useAuthStore.getState().hydrated) return;
      void (async () => {
        try {
          const { data } = await supabase.auth.getSession();
          const uid = data.session?.user?.id ?? null;
          if (uid) {
            await syncFromSession(uid, "SAFETY_TIMEOUT");
          } else {
            // Sem sessão confirmada — marca hidratado; AuthGuard manda pro login
            setHydrated(true);
          }
        } catch {
          setHydrated(true);
        }
      })();
    }, 4000);

    return () => {
      mounted = false;
      window.clearTimeout(safety);
      subscription.unsubscribe();
    };
  }, [applyRemoteSession, setHydrated]);

  return <>{children}</>;
}
