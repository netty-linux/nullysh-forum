"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { uid } from "./utils";

export type ReportReason =
  | "spam"
  | "abuse"
  | "hate"
  | "nsfw"
  | "misinfo"
  | "other";

export const REPORT_REASONS: { id: ReportReason; label: string }[] = [
  { id: "spam", label: "Spam ou golpes" },
  { id: "abuse", label: "Assédio ou bullying" },
  { id: "hate", label: "Discurso de ódio" },
  { id: "nsfw", label: "Conteúdo sexual / impróprio" },
  { id: "misinfo", label: "Desinformação" },
  { id: "other", label: "Outro" },
];

export type PostReport = {
  id: string;
  postId: string;
  reporterId: string;
  reporterName: string;
  reason: ReportReason;
  note: string;
  createdAt: string;
  status: "open" | "reviewed";
};

interface ReportState {
  reports: PostReport[];
  reportPost: (data: {
    postId: string;
    reporterId: string;
    reporterName: string;
    reason: ReportReason;
    note?: string;
  }) => { ok: true; report: PostReport } | { ok: false; error: string };
  hasReported: (postId: string, reporterId: string) => boolean;
}

export const useReportStore = create<ReportState>()(
  persist(
    (set, get) => ({
      reports: [],

      hasReported: (postId, reporterId) =>
        get().reports.some(
          (r) =>
            r.postId === postId &&
            r.reporterId === reporterId &&
            r.status === "open"
        ),

      reportPost: ({ postId, reporterId, reporterName, reason, note }) => {
        if (!postId || !reporterId) {
          return { ok: false, error: "Dados inválidos." };
        }
        if (get().hasReported(postId, reporterId)) {
          return {
            ok: false,
            error: "Você já denunciou esta postagem. Nossa equipe vai analisar.",
          };
        }
        const report: PostReport = {
          id: uid("rep"),
          postId,
          reporterId,
          reporterName,
          reason,
          note: (note || "").trim().slice(0, 400),
          createdAt: new Date().toISOString(),
          status: "open",
        };
        set((s) => ({ reports: [report, ...s.reports] }));
        return { ok: true, report };
      },
    }),
    {
      name: "nullysh-reports",
      partialize: (s) => ({ reports: s.reports }),
    }
  )
);
