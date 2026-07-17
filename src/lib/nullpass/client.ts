/**
 * Client NullPass → API D1 (com headers admin reutilizados de vídeos).
 */

import type { NullpassProduct } from "@/lib/nullpass-catalog";
import type { NullpassUpsertInput } from "@/lib/nullpass/validate";
import { getAdminAuthHeaders } from "@/lib/videos/client";

export type NullpassListResponse = {
  ok: boolean;
  products?: NullpassProduct[];
  source?: "d1" | "empty";
  error?: string;
  code?: string;
};

export type NullpassMutationResponse = {
  ok: boolean;
  product?: NullpassProduct;
  error?: string;
  code?: string;
  count?: number;
};

const fetchOpts: RequestInit = {
  credentials: "include",
  cache: "no-store",
};

export async function fetchNullpassPublic(): Promise<NullpassListResponse> {
  try {
    const res = await fetch("/api/nullpass", fetchOpts);
    return (await res.json()) as NullpassListResponse;
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Falha de rede",
    };
  }
}

export async function fetchNullpassAdmin(): Promise<NullpassListResponse> {
  try {
    const headers = await getAdminAuthHeaders();
    const res = await fetch("/api/nullpass/admin", {
      ...fetchOpts,
      headers,
    });
    return (await res.json()) as NullpassListResponse;
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Falha de rede",
    };
  }
}

export async function apiCreateNullpass(
  input: NullpassUpsertInput
): Promise<NullpassMutationResponse> {
  try {
    const headers = await getAdminAuthHeaders();
    const res = await fetch("/api/nullpass/admin", {
      method: "POST",
      credentials: "include",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
    return (await res.json()) as NullpassMutationResponse;
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Falha de rede",
    };
  }
}

export async function apiUpdateNullpass(
  id: string,
  input: NullpassUpsertInput
): Promise<NullpassMutationResponse> {
  try {
    const headers = await getAdminAuthHeaders();
    const res = await fetch(`/api/nullpass/admin/${encodeURIComponent(id)}`, {
      method: "PATCH",
      credentials: "include",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
    return (await res.json()) as NullpassMutationResponse;
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Falha de rede",
    };
  }
}

export async function apiDeleteNullpass(
  id: string
): Promise<NullpassMutationResponse> {
  try {
    const headers = await getAdminAuthHeaders();
    const res = await fetch(`/api/nullpass/admin/${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "include",
      headers,
    });
    return (await res.json()) as NullpassMutationResponse;
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Falha de rede",
    };
  }
}

export async function apiResetNullpassSeed(): Promise<NullpassMutationResponse> {
  try {
    const headers = await getAdminAuthHeaders();
    const res = await fetch("/api/nullpass/admin/reset-seed", {
      method: "POST",
      credentials: "include",
      headers,
    });
    return (await res.json()) as NullpassMutationResponse;
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Falha de rede",
    };
  }
}

export type NullpassCoverUploadResponse = {
  ok: boolean;
  publicUrl?: string;
  objectKey?: string;
  error?: string;
  code?: string;
};

/** Upload capa → R2; retorna publicUrl same-origin (/api/nullpass/cover/…). */
export async function apiUploadNullpassCover(
  file: Blob,
  filename = "cover.jpg"
): Promise<NullpassCoverUploadResponse> {
  try {
    const headers = await getAdminAuthHeaders();
    const form = new FormData();
    form.append("file", file, filename);
    const res = await fetch("/api/nullpass/admin/upload-cover", {
      method: "POST",
      credentials: "include",
      headers,
      body: form,
    });
    return (await res.json()) as NullpassCoverUploadResponse;
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Falha de rede no upload",
    };
  }
}
