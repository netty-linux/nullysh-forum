"use client";

import type { ProfileUpdate, UserPublic } from "@/lib/types";
import {
  initials,
  normalizeUsername,
  usernameValidationError,
} from "@/lib/utils";
import { getSupabaseBrowser, requireSupabaseBrowser } from "./client";
import { profileRowToUser, userUpdateToRow, type ProfileRow } from "./mappers";
import { ensureRemoteMedia } from "./storage";

/** Traduz erros do Supabase Auth para PT-BR acionáveis */
function mapAuthError(message: string): string {
  const m = (message || "").toLowerCase();

  if (
    m.includes("rate limit") ||
    m.includes("email rate limit exceeded") ||
    m.includes("over_email_send_rate_limit")
  ) {
    return (
      "Limite de e-mails do Supabase atingido (muitos cadastros seguidos). " +
      "Aguarde alguns minutos e tente de novo. " +
      "No Dashboard: Authentication → Providers → Email → desative “Confirm email” no MVP " +
      "para não enviar e-mail a cada conta. Se a conta já foi criada, use Entrar."
    );
  }
  if (m.includes("user already registered") || m.includes("already been registered")) {
    return "Este e-mail já está cadastrado. Faça login.";
  }
  if (m.includes("email address") && m.includes("invalid")) {
    return "E-mail inválido. Use um endereço real (ex.: Gmail).";
  }
  if (m.includes("password") && (m.includes("weak") || m.includes("least"))) {
    return "Senha fraca. Use no mínimo 10 caracteres com maiúsculas, minúsculas e números.";
  }
  if (
    m.includes("different from the old") ||
    m.includes("same password") ||
    m.includes("should be different")
  ) {
    return "A nova senha precisa ser diferente da atual.";
  }
  if (m.includes("email not confirmed")) {
    return (
      "E-mail ainda não confirmado. No MVP, desative a confirmação em " +
      "Authentication → Providers → Email → Confirm email."
    );
  }
  if (m.includes("invalid login") || m.includes("invalid credentials")) {
    return "E-mail ou senha incorretos.";
  }
  return message || "Erro de autenticação.";
}

export async function fetchProfileById(
  id: string
): Promise<UserPublic | null> {
  const supabase = getSupabaseBrowser();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return profileRowToUser(data as ProfileRow);
}

export async function fetchAllProfiles(): Promise<UserPublic[]> {
  const supabase = getSupabaseBrowser();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return (data as ProfileRow[]).map(profileRowToUser);
}

export async function supabaseRegister(input: {
  name: string;
  email: string;
  password: string;
}): Promise<{ ok: true; user: UserPublic } | { ok: false; error: string }> {
  try {
    const supabase = requireSupabaseBrowser();
    const email = input.email.trim().toLowerCase();
    const name = input.name.trim();

    if (!name || !email || !input.password) {
      return { ok: false, error: "Preencha todos os campos." };
    }
    if (input.password.length < 10) {
      return {
        ok: false,
        error: "A senha precisa ter no mínimo 10 caracteres.",
      };
    }
    const hasUpper = /[A-Z]/.test(input.password);
    const hasLower = /[a-z]/.test(input.password);
    const hasNumber = /[0-9]/.test(input.password);
    if (!hasUpper || !hasLower || !hasNumber) {
      return {
        ok: false,
        error:
          "A senha deve conter pelo menos uma letra maiúscula, uma minúscula e um número.",
      };
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password: input.password,
      options: {
        data: { name },
        // evita e-mail de boas-vindas extra quando o projeto permite
        emailRedirectTo:
          typeof window !== "undefined"
            ? `${window.location.origin}/app`
            : undefined,
      },
    });

    if (error) {
      const mapped = mapAuthError(error.message);
      // Rate limit: se a conta já existe, orientar login
      if (
        error.message.toLowerCase().includes("rate limit") ||
        error.message.toLowerCase().includes("email rate limit")
      ) {
        // tenta login silencioso — se a conta já foi criada antes do rate limit
        const loginTry = await supabase.auth.signInWithPassword({
          email,
          password: input.password,
        });
        if (loginTry.data.user && !loginTry.error) {
          const existing = await fetchProfileById(loginTry.data.user.id);
          if (existing) {
            // garante nome
            await supabase
              .from("profiles")
              .update({ name, avatar: initials(name) || "U" })
              .eq("id", loginTry.data.user.id);
            const refreshed = await fetchProfileById(loginTry.data.user.id);
            return { ok: true, user: refreshed || existing };
          }
        }
      }
      return { ok: false, error: mapped };
    }
    if (!data.user) {
      return { ok: false, error: "Não foi possível criar a conta." };
    }

    // Supabase retorna user sem identities quando o e-mail já existe
    if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return {
        ok: false,
        error: "Este e-mail já está cadastrado. Faça login.",
      };
    }

    // Garante profile (trigger também cria; upsert por segurança)
    await supabase.from("profiles").upsert(
      {
        id: data.user.id,
        email,
        name,
        avatar: initials(name) || "U",
      },
      { onConflict: "id" }
    );

    // Atualiza nome se o trigger usou só o e-mail
    await supabase
      .from("profiles")
      .update({ name, avatar: initials(name) || "U" })
      .eq("id", data.user.id);

    // Se a sessão não veio (confirm email ativo), tenta logar
    if (!data.session) {
      const loginTry = await supabase.auth.signInWithPassword({
        email,
        password: input.password,
      });
      if (loginTry.error) {
        return {
          ok: false,
          error: mapAuthError(
            loginTry.error.message ||
              "Conta criada, mas é preciso confirmar o e-mail. No MVP, desative Confirm email no Dashboard."
          ),
        };
      }
    }

    const profile = await fetchProfileById(data.user.id);
    if (!profile) {
      return {
        ok: false,
        error:
          "Conta criada, mas o perfil ainda não está disponível. Faça login.",
      };
    }

    return { ok: true, user: profile };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error ? mapAuthError(e.message) : "Erro no cadastro",
    };
  }
}

export async function supabaseLogin(
  email: string,
  password: string
): Promise<{ ok: true; user: UserPublic } | { ok: false; error: string }> {
  try {
    const supabase = requireSupabaseBrowser();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) {
      return { ok: false, error: mapAuthError(error.message) };
    }
    if (!data.user) {
      return { ok: false, error: "E-mail ou senha incorretos." };
    }
    const profile = await fetchProfileById(data.user.id);
    if (!profile) {
      return {
        ok: false,
        error: "Perfil não encontrado. Contate o suporte.",
      };
    }
    return { ok: true, user: profile };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? mapAuthError(e.message) : "Erro no login",
    };
  }
}

export async function supabaseLoginWithGoogle(): Promise<{
  ok: boolean;
  error?: string;
}> {
  try {
    const supabase = requireSupabaseBrowser();
    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/app`
        : undefined;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });

    if (error) {
      return { ok: false, error: mapAuthError(error.message) };
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error
          ? mapAuthError(e.message)
          : "Erro ao conectar com Google",
    };
  }
}

export async function supabaseLogout(): Promise<void> {
  const supabase = getSupabaseBrowser();
  if (!supabase) return;
  await supabase.auth.signOut();
}

/** Campos que o próprio usuário pode editar (allowlist anti mass-assignment). */
const PROFILE_SELF_EDIT_KEYS = [
  "name",
  "username",
  "bio",
  "email",
  "password",
  "avatarUrl",
  "bannerUrl",
  "bannerFit",
  "avatarFrame",
  "interests",
  "goals",
  "seekingMentorship",
  "offeringMentorship",
  "mentorTopics",
  "links",
  "favoriteTracks",
  "badgesUnlocked",
  "badgeEquipped",
] as const satisfies readonly (keyof ProfileUpdate)[];

function pickSelfEditableProfile(
  data: ProfileUpdate
): ProfileUpdate {
  const out: ProfileUpdate = {};
  for (const key of PROFILE_SELF_EDIT_KEYS) {
    if (data[key] !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (out as any)[key] = data[key];
    }
  }
  return out;
}

export async function supabaseUpdateProfile(
  userId: string,
  data: ProfileUpdate
): Promise<{ ok: true; user: UserPublic } | { ok: false; error: string }> {
  try {
    const supabase = requireSupabaseBrowser();

    // Só o dono da sessão pode atualizar o próprio perfil por este caminho
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user?.id || session.user.id !== userId) {
      return { ok: false, error: "Não autorizado a editar este perfil." };
    }

    // Allowlist: descarta is_vip, role, is_verified e qualquer chave extra
    data = pickSelfEditableProfile(data);

    // Perfil atual (para não reenviar e-mail/senha iguais)
    const current = await fetchProfileById(userId);

    // 1) Mídia primeiro (data URL → Storage) — não deve falhar por senha
    let avatarUrl = data.avatarUrl;
    let bannerUrl = data.bannerUrl;
    try {
      if (avatarUrl !== undefined) {
        avatarUrl = await ensureRemoteMedia(userId, "avatars", avatarUrl);
      }
      if (bannerUrl !== undefined) {
        bannerUrl = await ensureRemoteMedia(userId, "banners", bannerUrl);
      }
    } catch (e) {
      return {
        ok: false,
        error:
          e instanceof Error
            ? `Falha no upload da imagem: ${e.message}. Confira se os buckets avatars/banners existem no Storage.`
            : "Falha no upload da imagem (Storage).",
      };
    }

    // 2) Username (@) — único e público
    let nextUsername: string | undefined;
    if (data.username !== undefined) {
      const err = usernameValidationError(data.username);
      if (err) return { ok: false, error: err };
      nextUsername = normalizeUsername(data.username);
      if (
        current?.username &&
        normalizeUsername(current.username) === nextUsername
      ) {
        nextUsername = undefined; // sem mudança
      } else if (nextUsername) {
        const { data: clash } = await supabase
          .from("profiles")
          .select("id")
          .eq("username", nextUsername)
          .neq("id", userId)
          .maybeSingle();
        if (clash) {
          return {
            ok: false,
            error: "Este @ já está em uso. Escolha outro.",
          };
        }
      }
    }

    // 3) E-mail só se mudou de verdade (privado — auth, não perfil público)
    const nextEmail = data.email?.trim().toLowerCase();
    if (
      nextEmail &&
      current?.email &&
      nextEmail !== current.email.toLowerCase()
    ) {
      const { error: emErr } = await supabase.auth.updateUser({
        email: nextEmail,
      });
      if (emErr) return { ok: false, error: mapAuthError(emErr.message) };
    }

    // 4) Senha só se o caller mandou explicitamente (UI "Alterar senha")
    // Nunca deve vir no save de foto/banner/GIF — autofill do browser gerava
    // "New password should be different from the old password" e abortava tudo.
    const nextPassword =
      typeof data.password === "string" ? data.password.trim() : "";
    if (nextPassword.length >= 6) {
      const { error: pwErr } = await supabase.auth.updateUser({
        password: nextPassword,
      });
      if (pwErr) {
        const msg = (pwErr.message || "").toLowerCase();
        if (
          msg.includes("different from the old") ||
          msg.includes("same password") ||
          msg.includes("should be different")
        ) {
          // Não bloqueia avatar/banner — só avisa no console
          console.warn("[profile] senha ignorada (igual à atual)");
        } else {
          return { ok: false, error: mapAuthError(pwErr.message) };
        }
      }
    }

    const nextName = data.name?.trim();
    const row = userUpdateToRow({
      ...data,
      name: nextName,
      username: nextUsername,
      avatar: nextName !== undefined ? initials(nextName) || "U" : undefined,
      avatarUrl,
      bannerUrl,
      // não manda e-mail no row se não mudou (evita update inútil)
      email:
        nextEmail && current && nextEmail !== current.email.toLowerCase()
          ? nextEmail
          : nextEmail && !current
            ? nextEmail
            : undefined,
    });

    // Remove password do payload de profiles (não existe na tabela)
    delete (row as { password?: string }).password;

    let { error } = await supabase
      .from("profiles")
      .update(row)
      .eq("id", userId);

    // Coluna username ainda não migrada → tenta sem ela
    if (error && error.message.toLowerCase().includes("username")) {
      console.warn(
        "[profile] coluna username ausente — rode a migration. Salvando sem @."
      );
      delete row.username;
      ({ error } = await supabase.from("profiles").update(row).eq("id", userId));
    }

    // Colunas de emblema ainda não migradas no projeto → tenta sem elas
    if (
      error &&
      (error.message.includes("badge_equipped") ||
        error.message.includes("badges_unlocked") ||
        error.message.includes("badge_"))
    ) {
      console.warn(
        "[profile] colunas de emblema ausentes no Supabase — salvando resto do perfil. Rode supabase/migrations/20260710_profile_badges.sql"
      );
      const rowNoBadge = { ...row };
      delete rowNoBadge.badge_equipped;
      delete rowNoBadge.badges_unlocked;
      const retry = await supabase
        .from("profiles")
        .update(rowNoBadge)
        .eq("id", userId);
      error = retry.error;
    }

    if (error) return { ok: false, error: error.message };

    const profile = await fetchProfileById(userId);
    if (!profile) return { ok: false, error: "Perfil não encontrado." };

    // Merge emblemas do payload (se o DB ainda não devolve as colunas)
    const merged = {
      ...profile,
      badgesUnlocked:
        data.badgesUnlocked !== undefined
          ? data.badgesUnlocked
          : profile.badgesUnlocked ?? current?.badgesUnlocked ?? [],
      badgeEquipped:
        data.badgeEquipped !== undefined
          ? data.badgeEquipped
          : profile.badgeEquipped ?? current?.badgeEquipped ?? null,
    };

    return { ok: true, user: merged };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error
          ? mapAuthError(e.message)
          : "Erro ao atualizar perfil",
    };
  }
}

/**
 * Self-service VIP no cliente FOI DESATIVADO (AppSec).
 * Antes qualquer user autenticado podia UPDATE is_vip=true no próprio perfil.
 * VIP real deve ser setado por webhook de pagamento (service role) ou admin.
 * Demo local sem Supabase continua via auth-store.activateVip offline.
 */
export async function supabaseActivateVip(
  _userId: string
): Promise<{ ok: true; user: UserPublic } | { ok: false; error: string }> {
  return {
    ok: false,
    error:
      "Ativação VIP no cliente desabilitada por segurança. Use o fluxo de pagamento (servidor) ou painel admin.",
  };
}

export async function supabaseGetSessionUser(): Promise<UserPublic | null> {
  const supabase = getSupabaseBrowser();
  if (!supabase) return null;
  // getUser() revalida o JWT no servidor Auth (mais confiável que getSession
  // cacheado, que às vezes vinha null no 1º tick e “deslogava” o app).
  const { data: userData, error } = await supabase.auth.getUser();
  if (error || !userData.user) {
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user?.id;
    if (!uid) return null;
    return fetchProfileById(uid);
  }
  return fetchProfileById(userData.user.id);
}

export async function supabaseSetVerified(
  userId: string,
  verified: boolean
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const supabase = requireSupabaseBrowser();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user?.id) {
      return { ok: false, error: "Não autenticado." };
    }

    // Só admin (profiles.role) pode marcar verificado — confere no DB
    const { data: me, error: meErr } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .maybeSingle();
    if (meErr || !me || me.role !== "admin") {
      return { ok: false, error: "Apenas admin pode alterar verificação." };
    }

    const { error } = await supabase
      .from("profiles")
      .update({ is_verified: verified })
      .eq("id", userId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Erro",
    };
  }
}

/**
 * Admin doa / revoga VIP em outro membro.
 * - is_vip = true/false
 * - role: member ↔ vip (nunca mexe em admin)
 * Protegido por RLS (update own or admin) + trigger de colunas privilegiadas.
 */
export async function supabaseSetVip(
  userId: string,
  vip: boolean
): Promise<{ ok: true; user: UserPublic } | { ok: false; error: string }> {
  try {
    const supabase = requireSupabaseBrowser();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user?.id) {
      return { ok: false, error: "Não autenticado." };
    }

    const { data: me, error: meErr } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .maybeSingle();
    if (meErr || !me || me.role !== "admin") {
      return { ok: false, error: "Apenas admin pode doar ou revogar VIP." };
    }

    const target = await fetchProfileById(userId);
    if (!target) {
      return { ok: false, error: "Membro não encontrado." };
    }
    if (target.role === "admin") {
      return {
        ok: false,
        error: "Contas admin já têm acesso total — não altere VIP nelas.",
      };
    }

    // role vip alinhado ao plano; admin nunca é rebaixado aqui
    const nextRole = vip ? "vip" : "member";

    const { error } = await supabase
      .from("profiles")
      .update({
        is_vip: vip,
        role: nextRole,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (error) return { ok: false, error: error.message };

    const refreshed = await fetchProfileById(userId);
    if (!refreshed) {
      return {
        ok: true,
        user: {
          ...target,
          isVip: vip,
          role: nextRole,
        },
      };
    }
    return { ok: true, user: refreshed };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Erro ao atualizar VIP.",
    };
  }
}
