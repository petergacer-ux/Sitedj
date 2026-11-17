"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { hero } from "@/content/site";
import { StageBeams } from "@/components/fx/StageBeams";
import { Equalizer } from "@/components/fx/Equalizer";
import { MagneticButton } from "@/components/ui/Magnetic";
import { useReducedMotion } from "@/lib/hooks";
import { motion as tk } from "@/styles/tokens";

function Letters({ word, delay }: { word: string; delay: number }) {
  return (
    <span className="inline-flex" aria-hidden>
      {word.split("").map((l, i) => (
        <motion.span
          key={i}
          className="inline-block will-change-transform"
          initial={{ opacity: 0, y: "0.35em", filter: "blur(8px)" }}
          animate={{ opacity: 1, y: "0em", filter: "blur(0px)" }}
          transition={{ duration: 0.9, ease: tk.easeArray, delay: delay + i * 0.05 }}
        >
          {l === " " ? " " : l}
        </motion.span>
      ))}
    </span>
  );
}

export function Hero() {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const contentY = useTransform(scrollYProgress, [0, 1], ["0%", "20%"]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const titre = hero.titre.join(" ");
  const after = 0.3 + titre.length * 0.05;

  return (
    <section
      ref={ref}
      id="top"
      aria-label="Millenium DJ Animation"
      className="relative isolate flex min-h-[100svh] items-center overflow-hidden bg-night-950"
    >
      <div aria-hidden className="absolute inset-0 -z-10">
        <StageBeams reduced={reduced} />
      </div>
      <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-1/2 bg-gradient-to-t from-night-950 to-transparent" />

      <motion.div
        style={reduced ? undefined : { y: contentY, opacity: contentOpacity }}
        className="container-stage relative flex flex-col items-center pb-32 pt-32 text-center"
      >
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="eyebrow mb-8 flex items-center gap-2.5"
        >
          <span className="size-1.5 rounded-full bg-gold" aria-hidden />
          {hero.surTitre}
        </motion.p>

        <h1
          className="font-display text-[clamp(3.25rem,13vw,9.5rem)] font-semibold leading-[0.95] tracking-[-0.045em] text-ink"
          aria-label={`${titre} — ${hero.accroche}`}
        >
          <Letters word={titre} delay={0.3} />
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: tk.easeArray, delay: after }}
          className="mt-5 font-serif text-[clamp(1.5rem,3.4vw,2.5rem)] italic leading-tight text-gold"
        >
          {hero.accroche}
        </motion.p>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.9, delay: after + 0.15 }}
          className="mt-6 max-w-lg text-base leading-relaxed text-ink-muted sm:text-lg text-pretty"
        >
          {hero.sousTitre}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: tk.easeArray, delay: after + 0.3 }}
          className="mt-10 flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center"
        >
          <MagneticButton href={hero.ctaPrincipal.href}>
            {hero.ctaPrincipal.label}
            <Arrow />
          </MagneticButton>
          <MagneticButton href={hero.ctaSecondaire.href} variant="ghost">
            {hero.ctaSecondaire.label}
          </MagneticButton>
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2, delay: after + 0.2 }}
        className="pointer-events-none absolute inset-x-0 bottom-0 h-12 opacity-60 [mask-image:linear-gradient(90deg,transparent,#000_25%,#000_75%,transparent)] sm:h-16"
      >
        <Equalizer bars={40} />
      </motion.div>
    </section>
  );
}

export function Arrow() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
