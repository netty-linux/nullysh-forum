"use client";

import { useAuthStore } from "@/lib/auth-store";
import { useForumStore } from "@/lib/forum-store";
import {
  isGhostComment,
  isGhostMessage,
  isGhostPost,
  isGhostUser,
  isGhostUserId,
} from "@/lib/ghost-data";
import { useSocialStore } from "@/lib/social-store";
import {
  fetchAllProfiles,
  fetchProfileById,
} from "@/lib/supabase/auth-service";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { isEmailAllowed } from "@/lib/access-control";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { UserPublic } from "@/lib/types";
import { useEffect, useRef } from "react";

/** Remove contas/posts/comentários seed do storage em memória (1× por load). */
function purgeGhostLocalData() {
  const auth = useAuthStore.getState();
  const cleanUsers = auth.users.filter((u) => !isGhostUser(u));
  if (cleanUsers.length !== auth.users.length) {
    useAuthStore.setState({
      users: cleanUsers,
      currentUserId:
        auth.currentUserId && isGhostUserId(auth.currentUserId)
          ? null
          : auth.currentUserId,
    });
  }

  const forum = useForumStore.getState();
  const posts = forum.posts.filter((p) => !isGhostPost(p));
  const postIds = new Set(posts.map((p) => p.id));
  const comments = forum.comments.filter(
    (c) => !isGhostComment(c) && postIds.has(c.postId)
  );
  const messages = forum.messages.filter((m) => !isGhostMessage(m));
  if (
    posts.length !== forum.posts.length ||
    comments.length !== forum.comments.length ||
    messages.length !== forum.messages.length
  ) {
    useForumStore.setState({ posts, comments, messages });
  }

  const social = useSocialStore.getState();
  const follows = social.follows.filter(
    (f) => !isGhostUserId(f.followerId) && !isGhostUserId(f.followingId)
  );
  const stories = social.stories.filter((s) => !isGhostUserId(s.authorId));
  if (
    follows.length !== social.follows.length ||
    stories.length !== social.stories.length
  ) {
    useSocialStore.setState({ follows, stories });
  }
}

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
    // Sempre limpa fantasmas legados do localStorage (mesmo se migrate falhar)
    purgeGhostLocalData();

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
          // Importante: não passar users:[me] de forma a apagar o catálogo —
          // applyRemoteSession agora mescla; mesmo assim enviamos o que der.
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

        if (me && !isEmailAllowed(me.email)) {
          console.warn(
            "[supabase-bridge] E-mail não autorizado durante o desenvolvimento:",
            me.email
          );
          const client = getSupabaseBrowser();
          if (client) await client.auth.signOut();
          applyRemoteSession({ currentUser: null, users: profiles });
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
