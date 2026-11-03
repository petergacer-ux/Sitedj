"use client";

import { motion, type Variants } from "framer-motion";
import type { ReactNode } from "react";
import { motion as tk } from "@/styles/tokens";

/** Révélation en masque : chaque ligne/mot monte depuis derrière un cache. */
export function MaskText({
  text,
  as: Tag = "h2",
  className = "",
  delay = 0,
  by = "word",
  id,
}: {
  id?: string;
  text: string;
  as?: "h1" | "h2" | "h3" | "p" | "span";
  className?: string;
  delay?: number;
  by?: "word" | "line";
}) {
  const parts = by === "word" ? text.split(" ") : [text];
  const MotionTag = motion[Tag];
  const container: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.06, delayChildren: delay } },
  };
  const child: Variants = {
    hidden: { y: "110%" },
    show: { y: "0%", transition: { duration: 0.9, ease: tk.easeArray } },
  };
  return (
    <MotionTag
      className={className}
      variants={container}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-10% 0px" }}
      aria-label={text}
      id={id}
    >
      {parts.map((w, i) => (
        <span key={i} aria-hidden className="inline-block overflow-hidden pb-[0.12em] -mb-[0.12em] align-bottom">
          <motion.span className="inline-block will-change-transform" variants={child}>
            {w}
            {by === "word" && i < parts.length - 1 ? " " : ""}
          </motion.span>
        </span>
      ))}
    </MotionTag>
  );
}

/** Apparition douce (fondu + léger glissement). */
export function FadeIn({
  children,
  delay = 0,
  className = "",
  y = 24,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  y?: number;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-8% 0px" }}
      transition={{ duration: tk.base + 0.2, ease: tk.easeArray, delay }}
    >
      {children}
    </motion.div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  intro,
  align = "left",
  titleId,
}: {
  titleId?: string;
  eyebrow: string;
  title: string;
  intro?: string;
  align?: "left" | "center";
}) {
  return (
    <div className={`max-w-3xl ${align === "center" ? "mx-auto text-center" : ""}`}>
      <FadeIn>
        <p className="eyebrow mb-5 flex items-center gap-3 data-[c=1]:justify-center" data-c={align === "center" ? 1 : 0}>
          <span className="h-px w-8 bg-gold/60" aria-hidden />
          {eyebrow}
        </p>
      </FadeIn>
      <MaskText
        id={titleId}
        text={title}
        className="font-display text-[clamp(2rem,5.2vw,4.25rem)] font-semibold leading-[1.02] tracking-[-0.02em] text-balance"
      />
      {intro && (
        <FadeIn delay={0.15}>
          <p className="mt-6 text-lg text-ink-muted text-pretty">
            {intro}
          </p>
        </FadeIn>
      )}
    </div>
  );
}
