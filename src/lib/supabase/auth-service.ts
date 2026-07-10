"use client";

import type { ProfileUpdate, UserPublic } from "@/lib/types";
import { initials } from "@/lib/utils";
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
    return "Senha fraca. Use no mínimo 6 caracteres.";
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
    if (input.password.length < 6) {
      return {
        ok: false,
        error: "A senha precisa ter no mínimo 6 caracteres.",
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

export async function supabaseLogout(): Promise<void> {
  const supabase = getSupabaseBrowser();
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function supabaseUpdateProfile(
  userId: string,
  data: ProfileUpdate
): Promise<{ ok: true; user: UserPublic } | { ok: false; error: string }> {
  try {
    const supabase = requireSupabaseBrowser();

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

    // 2) E-mail só se mudou de verdade
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

    // 3) Senha só se o caller mandou explicitamente (UI "Alterar senha")
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

export async function supabaseActivateVip(
  userId: string
): Promise<{ ok: true; user: UserPublic } | { ok: false; error: string }> {
  try {
    const supabase = requireSupabaseBrowser();
    const { error } = await supabase
      .from("profiles")
      .update({
        is_vip: true,
        role: "vip",
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .neq("role", "admin");

    // admin mantém role admin
    await supabase
      .from("profiles")
      .update({ is_vip: true, updated_at: new Date().toISOString() })
      .eq("id", userId)
      .eq("role", "admin");

    if (error) {
      // pode falhar se RLS bloquear self-promote — em prod use edge function
      console.warn("[vip]", error.message);
    }

    // fallback local-friendly: tenta update is_vip only
    await supabase
      .from("profiles")
      .update({ is_vip: true })
      .eq("id", userId);

    const profile = await fetchProfileById(userId);
    if (!profile) return { ok: false, error: "Perfil não encontrado." };
    return { ok: true, user: profile };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Erro ao ativar VIP",
    };
  }
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
