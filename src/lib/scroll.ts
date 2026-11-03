"use client";

import type Lenis from "lenis";

/**
 * État de scroll partagé (lu dans les boucles d'animation, sans re-render React).
 * velocity : pixels / frame (signé), lissé.
 */
export const scrollState = {
  velocity: 0,
  lenis: null as Lenis | null,
};

export function scrollToHash(hash: string) {
  const el = document.querySelector(hash);
  if (!el) return false;
  if (scrollState.lenis) scrollState.lenis.scrollTo(el as HTMLElement, { offset: -20 });
  else el.scrollIntoView({ behavior: "smooth" });
  return true;
}
