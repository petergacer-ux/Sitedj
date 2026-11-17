"use client";

import { useEffect, useRef } from "react";
import { musique } from "@/content/site";
import { SectionHeading } from "@/components/ui/Reveal";
import { scrollState } from "@/lib/scroll";
import { useReducedMotion } from "@/lib/hooks";

/** Bandeau défilant ; accélère avec la vitesse de scroll. */
function Marquee({ items, direction, accent }: { items: string[]; direction: 1 | -1; accent: "gold" | "magenta" }) {
  const track = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    const el = track.current!;
    let x = 0;
    let raf = 0;
    let last = performance.now();
    let visible = false;
    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const half = el.scrollWidth / 2;
      const boost = Math.min(Math.abs(scrollState.velocity) * 22, 900);
      x -= direction * (55 + boost) * dt;
      if (x <= -half) x += half;
      if (x > 0) x -= half;
      el.style.transform = `translate3d(${x}px,0,0)`;
      raf = requestAnimationFrame(loop);
    };
    const run = () => {
      cancelAnimationFrame(raf);
      if (visible && !document.hidden) {
        last = performance.now();
        raf = requestAnimationFrame(loop);
      }
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      run();
    });
    io.observe(wrap.current!);
    document.addEventListener("visibilitychange", run);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener("visibilitychange", run);
    };
  }, [direction, reduced]);

  const row = [...items, ...items];
  return (
    <div ref={wrap} className="relative overflow-hidden py-3 [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]">
      <div ref={track} className={`flex w-max will-change-transform ${reduced ? "flex-wrap !w-auto justify-center gap-y-3" : ""}`}>
        {(reduced ? items : row).map((s, i) => (
          <span key={i} aria-hidden={i >= items.length} className="flex shrink-0 items-center">
            <span
              className={`px-5 font-display text-[clamp(1.75rem,4.4vw,3.5rem)] font-medium tracking-[-0.04em] sm:px-8 ${
                (i + (accent === "gold" ? 0 : 1)) % 2 === 0
                  ? "text-ink"
                  : "font-serif font-normal italic tracking-normal text-gold"
              }`}
            >
              {s}
            </span>
            <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-ink-faint" />
          </span>
        ))}
      </div>
    </div>
  );
}

export function Musique() {
  const half = Math.ceil(musique.styles.length / 2);
  const a = musique.styles.slice(0, half);
  const b = musique.styles.slice(half);
  return (
    <section id="musique" aria-labelledby="musique-titre" className="relative section-pad overflow-hidden">
            <div className="container-stage">
        <SectionHeading titleId="musique-titre" eyebrow={musique.surTitre} title={musique.titre} intro={musique.intro} align="center" />
      </div>
      <ul className="sr-only">
        {musique.styles.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
      <div aria-hidden className="mt-16 space-y-1 border-y border-line py-6 sm:space-y-2">
        <Marquee items={a} direction={1} accent="gold" />
        <Marquee items={b} direction={-1} accent="magenta" />
      </div>
    </section>
  );
}
