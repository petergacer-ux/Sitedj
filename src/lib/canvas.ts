"use client";

import { useEffect, useRef } from "react";

export type CanvasFrame = {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  /** secondes écoulées depuis le démarrage */
  t: number;
  /** delta en secondes (borné) */
  dt: number;
};

type Options = {
  /** Si false, la boucle est suspendue (ex : carte non survolée). */
  active?: boolean;
  /** Mouvement réduit : on dessine une seule image statique. */
  reduced?: boolean;
  /** Plafond de densité de pixels (perf). */
  maxDpr?: number;
  /** Appelé au redimensionnement. */
  onResize?: (w: number, h: number) => void;
};

/**
 * Boucle canvas 2D performante :
 * - DPR plafonné, redimensionnement via ResizeObserver
 * - pause hors écran (IntersectionObserver) et onglet caché
 * - une seule frame statique si mouvement réduit
 */
export function useCanvasLoop(
  draw: (f: CanvasFrame) => void,
  { active = true, reduced = false, maxDpr = 1.75, onResize }: Options = {},
) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef(draw);
  const resizeRef = useRef(onResize);
  drawRef.current = draw;
  resizeRef.current = onResize;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let raf = 0;
    let visible = false;
    let last = performance.now();
    let t = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
      w = Math.max(1, rect.width);
      h = Math.max(1, rect.height);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      resizeRef.current?.(w, h);
      if (reduced || !active) frame(true);
    };

    const frame = (once = false) => {
      const now = performance.now();
      const dt = Math.min((now - last) / 1000, 1 / 20);
      last = now;
      t += once ? 0 : dt;
      drawRef.current({ ctx, w, h, t: reduced ? 2.5 : t, dt: once ? 0 : dt });
    };

    const loop = () => {
      frame();
      raf = requestAnimationFrame(loop);
    };

    const start = () => {
      if (raf || reduced || !active || !visible || document.hidden) return;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const io = new IntersectionObserver(
      ([e]) => {
        visible = e.isIntersecting;
        if (visible) start();
        else stop();
      },
      { rootMargin: "100px" },
    );
    io.observe(canvas);
    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVis);

    resize();
    if (reduced || !active) frame(true);

    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [active, reduced, maxDpr]);

  return ref;
}
