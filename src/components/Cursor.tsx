"use client";

import { useEffect, useRef } from "react";
import { useFinePointer, useReducedMotion } from "@/lib/hooks";

/** Petit halo lumineux qui suit la souris — ordinateur uniquement. */
export function Cursor() {
  const fine = useFinePointer();
  const reduced = useReducedMotion();
  const dot = useRef<HTMLDivElement>(null);
  const halo = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!fine || reduced) return;
    const d = dot.current!;
    const h = halo.current!;
    let x = innerWidth / 2, y = innerHeight / 2, hx = x, hy = y;
    let raf = 0;
    let shown = false;
    let hover = false;

    const move = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      if (!shown) {
        shown = true;
        hx = x; hy = y;
        d.style.opacity = "1";
        h.style.opacity = "1";
      }
      const target = (e.target as HTMLElement).closest("a, button, [data-cursor], input, select, textarea, label");
      if (!!target !== hover) {
        hover = !!target;
        h.dataset.hover = hover ? "1" : "0";
      }
    };
    const leave = () => {
      shown = false;
      d.style.opacity = "0";
      h.style.opacity = "0";
    };
    const loop = () => {
      hx += (x - hx) * 0.16;
      hy += (y - hy) * 0.16;
      d.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      h.style.transform = `translate3d(${hx}px, ${hy}px, 0)`;
      raf = requestAnimationFrame(loop);
    };
    addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("pointerleave", leave);
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", leave);
    };
  }, [fine, reduced]);

  if (!fine || reduced) return null;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[70]">
      <div
        ref={halo}
        data-hover="0"
        className="absolute left-0 top-0 -ml-5 -mt-5 size-10 rounded-full opacity-0 transition-[width,height,margin,background-color,opacity] duration-300 ease-stage data-[hover=1]:-ml-8 data-[hover=1]:-mt-8 data-[hover=1]:size-16 data-[hover=1]:bg-gold/10"
        style={{
          boxShadow: "0 0 30px rgb(var(--rgb-gold) / .35), inset 0 0 12px rgb(var(--rgb-gold) / .25)",
          border: "1px solid rgb(var(--rgb-gold) / .45)",
        }}
      />
      <div
        ref={dot}
        className="absolute left-0 top-0 -ml-[3px] -mt-[3px] size-[6px] rounded-full bg-gold-soft opacity-0"
        style={{ boxShadow: "0 0 10px var(--c-gold)" }}
      />
    </div>
  );
}
