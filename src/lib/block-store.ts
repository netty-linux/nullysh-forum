"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type BlockRelation = {
  /** Quem bloqueou */
  blockerId: string;
  /** Quem foi bloqueado */
  blockedId: string;
  createdAt: string;
};

interface BlockState {
  blocks: BlockRelation[];
  /** Eu bloqueei este usuário? */
  hasBlocked: (meId: string, otherId: string) => boolean;
  /** Este usuário me bloqueou? */
  isBlockedBy: (meId: string, otherId: string) => boolean;
  /** Existe bloqueio em qualquer direção (posts, DMs)? */
  isEitherBlocked: (a: string, b: string) => boolean;
  blockUser: (meId: string, otherId: string) => { ok: true } | { ok: false; error: string };
  unblockUser: (meId: string, otherId: string) => { ok: true } | { ok: false; error: string };
  /** IDs que eu bloqueei */
  listBlockedByMe: (meId: string) => string[];
}

export const useBlockStore = create<BlockState>()(
  persist(
    (set, get) => ({
      blocks: [],

      hasBlocked: (meId, otherId) =>
        get().blocks.some(
          (b) => b.blockerId === meId && b.blockedId === otherId
        ),

      isBlockedBy: (meId, otherId) =>
        get().blocks.some(
          (b) => b.blockerId === otherId && b.blockedId === meId
        ),

      isEitherBlocked: (a, b) => {
        if (!a || !b || a === b) return false;
        return get().blocks.some(
          (rel) =>
            (rel.blockerId === a && rel.blockedId === b) ||
            (rel.blockerId === b && rel.blockedId === a)
        );
      },

      blockUser: (meId, otherId) => {
        if (!meId || !otherId) {
          return { ok: false, error: "Usuário inválido." };
        }
        if (meId === otherId) {
          return { ok: false, error: "Você não pode bloquear a si mesmo." };
        }
        if (get().hasBlocked(meId, otherId)) {
          return { ok: true };
        }
        set((s) => ({
          blocks: [
            {
              blockerId: meId,
              blockedId: otherId,
              createdAt: new Date().toISOString(),
            },
            ...s.blocks,
          ],
        }));
        return { ok: true };
      },

      unblockUser: (meId, otherId) => {
        if (!get().hasBlocked(meId, otherId)) {
          return { ok: false, error: "Este usuário não está bloqueado." };
        }
        set((s) => ({
          blocks: s.blocks.filter(
            (b) => !(b.blockerId === meId && b.blockedId === otherId)
          ),
        }));
        return { ok: true };
      },

      listBlockedByMe: (meId) =>
        get()
          .blocks.filter((b) => b.blockerId === meId)
          .map((b) => b.blockedId),
    }),
    {
      name: "nullysh-blocks",
      partialize: (s) => ({ blocks: s.blocks }),
    }
  )
);
