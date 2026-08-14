"use client";

import { ComposePostModal } from "@/components/compose-post-modal";
import { FabShell } from "@/components/fab-shell";
import { cn } from "@/lib/utils";
import { Plus } from "@phosphor-icons/react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

/** Evento legado — abre o modal de postagem */
export const COMPOSE_FOCUS_EVENT = "nullysh:compose-focus";
export const COMPOSE_OPEN_EVENT = "nullysh:compose-open";

/** Re-export para quem importava de compose-fab */
export { FAB_SIZE_CLASS } from "@/components/fab-shell";

/**
 * FAB “nova postagem” — bolha premium alinhada à coluna lateral.
 */
export function ComposeFab({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const openModal = useCallback(() => setOpen(true), []);
  const closeModal = useCallback(() => setOpen(false), []);

  useEffect(() => {
    function onOpen() {
      openModal();
    }
    window.addEventListener(COMPOSE_OPEN_EVENT, onOpen);
    window.addEventListener(COMPOSE_FOCUS_EVENT, onOpen);
    return () => {
      window.removeEventListener(COMPOSE_OPEN_EVENT, onOpen);
      window.removeEventListener(COMPOSE_FOCUS_EVENT, onOpen);
    };
  }, [openModal]);

  // Abre via ?compose=1 na URL — só na primeira montagem (deep link).
  const checkedComposeParam = useRef(false);
  useEffect(() => {
    if (checkedComposeParam.current) return;
    checkedComposeParam.current = true;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("compose") !== "1") return;
    const onFeed = pathname === "/app" || pathname === "/app/";
    if (onFeed) {
      router.replace("/app", { scroll: false });
    }
    // Fora do corpo síncrono do efeito: dispara no próximo microtask,
    // já que abrir o modal aqui é resposta a um deep link (URL), não
    // sincronização derivada de props/state do próprio componente.
    queueMicrotask(openModal);
  }, [pathname, router, openModal]);

  function onPublished() {
    const onFeed = pathname === "/app" || pathname === "/app/";
    if (!onFeed) {
      router.push("/app");
    }
  }

  return (
    <>
      <FabShell
        label="Nova postagem"
        title="Nova postagem"
        active={open}
        className={className}
        onClick={openModal}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Plus
          size={26}
          weight="bold"
          className={cn(
            "drop-shadow-[0_1px_2px_rgb(0_0_0/0.4)]",
            "transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
            open ? "rotate-45" : "group-hover/fab:rotate-90"
          )}
        />
      </FabShell>

      <ComposePostModal
        open={open}
        onClose={closeModal}
        onPublished={onPublished}
      />
    </>
  );
}
