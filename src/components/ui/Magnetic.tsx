"use client";

import Link from "next/link";
import { useRef, type ReactNode } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

type Props = {
  href?: string;
  onClick?: () => void;
  children: ReactNode;
  variant?: "gold" | "ghost";
  className?: string;
  type?: "button" | "submit";
  disabled?: boolean;
};

const MotionLink = motion.create(Link);

/** Bouton magnétique : il est attiré par le curseur (ordinateur). */
export function MagneticButton({ href, onClick, children, variant = "gold", className = "", type = "button", disabled }: Props) {
  const ref = useRef<HTMLElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 220, damping: 16, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 220, damping: 16, mass: 0.4 });

  const onMove = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || !ref.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = ref.current.getBoundingClientRect();
    x.set((e.clientX - (r.left + r.width / 2)) * 0.3);
    y.set((e.clientY - (r.top + r.height / 2)) * 0.4);
  };
  const reset = () => {
    x.set(0);
    y.set(0);
  };

  const base =
    "group relative inline-flex items-center justify-center gap-3 rounded-full px-7 py-4 font-display text-[0.8rem] font-medium uppercase tracking-[0.14em] transition-[box-shadow,background-color,color] duration-300 select-none disabled:opacity-60 disabled:pointer-events-none";
  const styles =
    variant === "gold"
      ? "bg-gold text-night-950 shadow-glow-gold hover:bg-gold-soft"
      : "glass text-ink hover:shadow-glow-magenta";

  const inner = (
    <>
      <span className="relative z-10 flex items-center gap-3">{children}</span>
      {variant === "gold" && (
        <span
          aria-hidden
          className="absolute inset-0 overflow-hidden rounded-full"
        >
          <span className="absolute -inset-y-2 -left-1/2 w-1/3 -skew-x-12 bg-white/40 blur-md transition-transform duration-700 ease-stage group-hover:translate-x-[420%]" />
        </span>
      )}
    </>
  );

  const common = {
    onPointerMove: onMove,
    onPointerLeave: reset,
    style: { x: sx, y: sy },
    className: `${base} ${styles} ${className}`,
  };

  if (href) {
    return (
      <MotionLink ref={ref as React.Ref<HTMLAnchorElement>} href={href} {...common}>
        {inner}
      </MotionLink>
    );
  }
  return (
    <motion.button ref={ref as React.Ref<HTMLButtonElement>} type={type} onClick={onClick} disabled={disabled} {...common}>
      {inner}
    </motion.button>
  );
}
