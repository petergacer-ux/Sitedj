"use client";

import { useEffect, useRef } from "react";
import { scrollState } from "@/lib/scroll";
import { useReducedMotion } from "@/lib/hooks";

/** Vinyle qui tourne et accélère avec la vitesse de scroll. */
export function Vinyl({ className = "" }: { className?: string }) {
  const disc = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    const el = disc.current!;
    let raf = 0;
    let angle = 0;
    let speed = 0;
    let last = performance.now();
    let visible = false;

    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      // 33 tours/min ≈ 200°/s, + accélération selon le scroll
      const target = 200 + Math.min(Math.abs(scrollState.velocity) * 90, 2400);
      speed += (target - speed) * 0.08;
      angle = (angle + speed * dt) % 360;
      el.style.transform = `rotate(${angle}deg)`;
      raf = requestAnimationFrame(loop);
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      cancelAnimationFrame(raf);
      if (visible && !document.hidden) {
        last = performance.now();
        raf = requestAnimationFrame(loop);
      }
    });
    io.observe(wrap.current!);
    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && visible) {
        last = performance.now();
        raf = requestAnimationFrame(loop);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [reduced]);

  return (
    <div ref={wrap} aria-hidden className={`relative aspect-square ${className}`}>
      {/* halo */}
      <div className="absolute inset-[-12%] rounded-full bg-[radial-gradient(circle,rgb(var(--rgb-magenta)/.35),rgb(var(--rgb-gold)/.12)_45%,transparent_70%)] blur-2xl" />
      <div
        ref={disc}
        className="absolute inset-0 rounded-full shadow-soft will-change-transform"
        style={{
          background: `
            conic-gradient(from 0deg, transparent 0 8%, rgb(255 255 255 / .12) 12%, transparent 18% 55%, rgb(255 255 255 / .08) 60%, transparent 66%),
            repeating-radial-gradient(circle at 50% 50%, #0b0d18 0 2px, #12152a 2.5px 3.5px),
            #090b16`,
          boxShadow: "inset 0 0 0 2px rgb(255 255 255 / .06), 0 40px 80px -20px rgb(0 0 0 / .8)",
        }}
      >
        {/* étiquette */}
        <div className="absolute inset-[31%] grid place-items-center rounded-full bg-[conic-gradient(from_90deg,var(--c-gold),var(--c-gold-deep),var(--c-magenta),var(--c-gold))] shadow-[0_0_30px_rgb(var(--rgb-gold)/.4)]">
          <div className="absolute inset-[6%] rounded-full border border-night-950/30" />
          <span className="font-display text-[clamp(0.55rem,1.4vw,0.85rem)] font-bold tracking-[0.2em] text-night-950">MILLENIUM</span>
          <span className="absolute bottom-[22%] text-[clamp(0.4rem,0.9vw,0.55rem)] font-semibold uppercase tracking-[0.3em] text-night-950/70">DJ · 33⅓</span>
          <div className="absolute size-[9%] rounded-full bg-night-950" />
        </div>
      </div>
      {/* bras de lecture */}
      <svg viewBox="0 0 100 100" className="pointer-events-none absolute -right-[6%] -top-[4%] h-[70%] w-[50%] drop-shadow-[0_10px_20px_rgba(0,0,0,.6)]">
        <circle cx="78" cy="14" r="9" fill="#1a1f3a" stroke="var(--c-gold)" strokeWidth="1.2" />
        <circle cx="78" cy="14" r="3" fill="var(--c-gold)" />
        <path d="M78 14 L70 70 L52 88" fill="none" stroke="#c9ccd8" strokeWidth="2.6" strokeLinecap="round" />
        <rect x="44" y="84" width="12" height="7" rx="1.5" transform="rotate(-40 50 87)" fill="var(--c-gold)" />
      </svg>
    </div>
  );
}
