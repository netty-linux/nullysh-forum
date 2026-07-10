"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { EventRsvp, TrailProgress } from "./types";

interface ProgressState {
  trails: TrailProgress[];
  rsvps: EventRsvp[];
  toggleTrailStep: (trailId: string, stepId: string) => void;
  getTrailProgress: (trailId: string) => TrailProgress | undefined;
  toggleRsvp: (eventId: string, userId: string) => void;
  hasRsvp: (eventId: string, userId: string) => boolean;
  rsvpCount: (eventId: string) => number;
}

export const useProgressStore = create<ProgressState>()(
  persist(
    (set, get) => ({
      trails: [],
      rsvps: [],

      toggleTrailStep: (trailId, stepId) => {
        const now = new Date().toISOString();
        set((s) => {
          const existing = s.trails.find((t) => t.trailId === trailId);
          if (!existing) {
            return {
              trails: [
                ...s.trails,
                {
                  trailId,
                  completedStepIds: [stepId],
                  startedAt: now,
                  updatedAt: now,
                },
              ],
            };
          }
          const has = existing.completedStepIds.includes(stepId);
          const completedStepIds = has
            ? existing.completedStepIds.filter((id) => id !== stepId)
            : [...existing.completedStepIds, stepId];
          return {
            trails: s.trails.map((t) =>
              t.trailId === trailId
                ? { ...t, completedStepIds, updatedAt: now }
                : t
            ),
          };
        });
      },

      getTrailProgress: (trailId) =>
        get().trails.find((t) => t.trailId === trailId),

      toggleRsvp: (eventId, userId) => {
        const exists = get().rsvps.some(
          (r) => r.eventId === eventId && r.userId === userId
        );
        if (exists) {
          set((s) => ({
            rsvps: s.rsvps.filter(
              (r) => !(r.eventId === eventId && r.userId === userId)
            ),
          }));
        } else {
          set((s) => ({
            rsvps: [
              ...s.rsvps,
              {
                eventId,
                userId,
                createdAt: new Date().toISOString(),
              },
            ],
          }));
        }
      },

      hasRsvp: (eventId, userId) =>
        get().rsvps.some((r) => r.eventId === eventId && r.userId === userId),

      rsvpCount: (eventId) =>
        get().rsvps.filter((r) => r.eventId === eventId).length,
    }),
    {
      name: "nullysh-progress",
      partialize: (s) => ({ trails: s.trails, rsvps: s.rsvps }),
    }
  )
);
