import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** `true` só depois da hidratação — evita mismatch SSR/cliente (ex.: tema do next-themes). */
export function useMounted(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
