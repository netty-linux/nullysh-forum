import { useSyncExternalStore } from "react";

function subscribe() {
  return () => {};
}

/**
 * true somente após o componente montar no client.
 * Usado para gates de portal (createPortal precisa do document já montado)
 * sem cair no anti-padrão setState-em-effect — o snapshot do servidor
 * é sempre false, evitando mismatch de hidratação.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
}
