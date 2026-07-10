"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { VerificationRequest, VerificationStatus } from "./types";
import { uid } from "./utils";

interface VerificationState {
  requests: VerificationRequest[];
  submitRequest: (data: {
    userId: string;
    userName: string;
    userEmail: string;
    reason: string;
    identity: string;
    links: string;
    communityUse: string;
    isRealPerson: boolean;
  }) => { ok: true; request: VerificationRequest } | { ok: false; error: string };
  reviewRequest: (
    requestId: string,
    status: "approved" | "rejected",
    adminId: string,
    adminNote?: string
  ) => { ok: true; request: VerificationRequest } | { ok: false; error: string };
  getPending: () => VerificationRequest[];
  getByUserId: (userId: string) => VerificationRequest | undefined;
  getLatestByUserId: (userId: string) => VerificationRequest | undefined;
}

export const useVerificationStore = create<VerificationState>()(
  persist(
    (set, get) => ({
      requests: [],

      submitRequest: (data) => {
        if (!data.reason.trim() || data.reason.trim().length < 20) {
          return {
            ok: false,
            error: "Explique o motivo com pelo menos 20 caracteres.",
          };
        }
        if (!data.identity.trim() || data.identity.trim().length < 15) {
          return {
            ok: false,
            error: "Descreva quem você é com pelo menos 15 caracteres.",
          };
        }
        if (!data.communityUse.trim() || data.communityUse.trim().length < 15) {
          return {
            ok: false,
            error: "Descreva como usa a comunidade (mín. 15 caracteres).",
          };
        }
        if (!data.isRealPerson) {
          return {
            ok: false,
            error: "Confirme que é uma pessoa real e não um perfil fake.",
          };
        }

        const pending = get().requests.find(
          (r) => r.userId === data.userId && r.status === "pending"
        );
        if (pending) {
          return {
            ok: false,
            error: "Você já tem uma solicitação em análise.",
          };
        }

        const request: VerificationRequest = {
          id: uid("vr"),
          userId: data.userId,
          userName: data.userName,
          userEmail: data.userEmail,
          reason: data.reason.trim(),
          identity: data.identity.trim(),
          links: data.links.trim(),
          communityUse: data.communityUse.trim(),
          isRealPerson: true,
          status: "pending",
          adminNote: "",
          createdAt: new Date().toISOString(),
          reviewedAt: null,
          reviewedBy: null,
        };

        set((s) => ({ requests: [request, ...s.requests] }));
        return { ok: true, request };
      },

      reviewRequest: (requestId, status, adminId, adminNote = "") => {
        let updated: VerificationRequest | null = null;
        set((s) => ({
          requests: s.requests.map((r) => {
            if (r.id !== requestId) return r;
            if (r.status !== "pending") return r;
            updated = {
              ...r,
              status: status as VerificationStatus,
              adminNote: adminNote.trim(),
              reviewedAt: new Date().toISOString(),
              reviewedBy: adminId,
            };
            return updated;
          }),
        }));
        if (!updated) {
          return { ok: false, error: "Solicitação não encontrada ou já revisada." };
        }
        return { ok: true, request: updated };
      },

      getPending: () =>
        get()
          .requests.filter((r) => r.status === "pending")
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          ),

      getByUserId: (userId) =>
        get().requests.find((r) => r.userId === userId && r.status === "pending"),

      getLatestByUserId: (userId) =>
        get()
          .requests.filter((r) => r.userId === userId)
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )[0],
    }),
    {
      name: "nullysh-verification",
      partialize: (s) => ({ requests: s.requests }),
    }
  )
);
