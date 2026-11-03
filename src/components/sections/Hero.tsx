"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { hero } from "@/content/site";
import { StageBeams } from "@/components/fx/StageBeams";
import { Equalizer } from "@/components/fx/Equalizer";
import { MagneticButton } from "@/components/ui/Magnetic";
import { useReducedMotion } from "@/lib/hooks";
import { motion as tk } from "@/styles/tokens";

function Letters({ word, delay, className }: { word: string; delay: number; className?: string }) {
  return (
    <span className={`inline-flex ${className ?? ""}`} aria-hidden>
      {word.split("").map((l, i) => (
        <motion.span
          key={i}
          className="inline-block will-change-transform"
          initial={{ opacity: 0, y: "0.45em", rotateX: -70, filter: "blur(12px)" }}
          animate={{ opacity: 1, y: "0em", rotateX: 0, filter: "blur(0px)" }}
          transition={{ duration: 1, ease: tk.easeArray, delay: delay + i * 0.075 }}
        >
          {l}
        </motion.span>
      ))}
    </span>
  );
}

export function Hero() {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const contentY = useTransform(scrollYProgress, [0, 1], ["0%", "28%"]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const [w1, w2] = hero.titre;
  const after = 0.35 + (w1.length + w2.length) * 0.075;

  return (
    <section
      ref={ref}
      id="top"
      aria-label="Millenium DJ Animation"
      className="relative isolate flex min-h-[100svh] items-center overflow-hidden bg-night-950"
    >
      {/* Fond : dégradé nuit + faisceaux */}
      <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(120%_80%_at_50%_0%,var(--c-night700)_0%,var(--c-night900)_45%,var(--c-night950)_80%)]" />
      <div aria-hidden className="absolute inset-0 -z-10">
        <StageBeams reduced={reduced} />
      </div>
      {/* Sol de la scène */}
      <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-1/3 bg-gradient-to-t from-night-950 via-night-950/70 to-transparent" />

      <motion.div
        style={reduced ? undefined : { y: contentY, opacity: contentOpacity }}
        className="container-stage relative flex flex-col items-center pb-28 pt-32 text-center"
      >
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="eyebrow mb-6 rounded-full border border-gold/25 bg-night-950/40 px-4 py-2 backdrop-blur"
        >
          {hero.surTitre}
        </motion.p>

        <h1
          className="font-display font-bold uppercase leading-[0.86] tracking-[-0.03em] [perspective:800px]"
          aria-label={`${w1} ${w2} — ${hero.accroche}`}
        >
          <Letters word={w1} delay={0.35} className="text-[clamp(2.6rem,12.2vw,10rem)] text-ink drop-shadow-[0_0_40px_rgb(var(--rgb-gold)/.25)]" />
          <br />
          <Letters
            word={w2}
            delay={0.35 + w1.length * 0.075}
            className="text-gradient text-glow-gold text-[clamp(3.2rem,15vw,12.5rem)]"
          />
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: tk.easeArray, delay: after }}
          className="mt-6 font-display text-[clamp(1.05rem,2.4vw,1.6rem)] font-light italic tracking-wide text-gold-soft"
        >
          « {hero.accroche} »
        </motion.p>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.9, delay: after + 0.15 }}
          className="mt-4 max-w-xl text-base text-ink-muted sm:text-lg text-pretty"
        >
          {hero.sousTitre}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: tk.easeArray, delay: after + 0.3 }}
          className="mt-10 flex w-full flex-col items-stretch gap-4 sm:w-auto sm:flex-row sm:items-center"
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

      {/* Égaliseur */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2, delay: after + 0.2 }}
        className="pointer-events-none absolute inset-x-0 bottom-0 h-20 [mask-image:linear-gradient(90deg,transparent,#000_20%,#000_80%,transparent)] sm:h-28"
      >
        <Equalizer bars={48} className="opacity-80" />
      </motion.div>
    </section>
  );
}

export function Arrow() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
