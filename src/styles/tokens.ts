/* ==========================================================================
   DESIGN TOKENS — source unique de l'identité visuelle.
   Ils sont injectés en variables CSS (:root) dans le layout, exposés à
   Tailwind via globals.css (@theme inline) et lus directement par les canvas.
   ========================================================================== */

export const colors = {
  /** Nuit : du presque noir au bleu marine du logo */
  night950: "#03050d",
  night900: "#060a1a",
  night800: "#0a1130",
  night700: "#111c48",
  navy: "#1b2a6b",
  /** Lumières */
  gold: "#f3c66b",
  goldSoft: "#ffe2a3",
  goldDeep: "#b98a33",
  magenta: "#ff2f8e",
  magentaSoft: "#ff7ab8",
  cyan: "#3fe3ff",
  violet: "#8b5cff",
  /** Texte */
  ink: "#f6f1e7",
  inkMuted: "#a9aec8",
  inkFaint: "#6b7194",
  line: "rgba(246, 241, 231, 0.10)",
} as const;

/** Les couleurs « lumière » au format RGB (pour les canvas et les rgba()). */
export const lightRGB = {
  gold: [243, 198, 107],
  magenta: [255, 47, 142],
  cyan: [63, 227, 255],
  violet: [139, 92, 255],
  white: [255, 244, 230],
} as const;

export type LightName = keyof typeof lightRGB;

export const fonts = {
  display: "var(--font-display)",
  body: "var(--font-body)",
} as const;

export const radii = {
  sm: "0.5rem",
  md: "1rem",
  lg: "1.75rem",
  xl: "2.5rem",
  pill: "999px",
} as const;

export const space = {
  /** Gouttière latérale (mobile → desktop) */
  gutter: "clamp(1rem, 4vw, 3rem)",
  /** Respiration verticale des sections */
  section: "clamp(5rem, 11vw, 9rem)",
  max: "80rem",
} as const;

export const glows = {
  gold: "0 0 0 1px rgba(243,198,107,.35), 0 0 24px rgba(243,198,107,.35), 0 0 80px rgba(243,198,107,.18)",
  magenta: "0 0 0 1px rgba(255,47,142,.35), 0 0 24px rgba(255,47,142,.35), 0 0 80px rgba(255,47,142,.18)",
  cyan: "0 0 0 1px rgba(63,227,255,.3), 0 0 24px rgba(63,227,255,.3), 0 0 80px rgba(63,227,255,.15)",
  soft: "0 30px 80px -20px rgba(0,0,0,.7)",
} as const;

export const motion = {
  ease: "cubic-bezier(0.22, 1, 0.36, 1)",
  easeArray: [0.22, 1, 0.36, 1] as [number, number, number, number],
  fast: 0.25,
  base: 0.6,
  slow: 1.1,
} as const;

const kebab = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

/** Génère le bloc de variables CSS injecté dans <head>. */
export function tokensToCss(): string {
  const vars: string[] = [];
  for (const [k, v] of Object.entries(colors)) vars.push(`--c-${kebab(k)}:${v}`);
  for (const [k, v] of Object.entries(lightRGB)) vars.push(`--rgb-${k}:${v.join(" ")}`);
  for (const [k, v] of Object.entries(radii)) vars.push(`--r-${k}:${v}`);
  for (const [k, v] of Object.entries(space)) vars.push(`--s-${k}:${v}`);
  for (const [k, v] of Object.entries(glows)) vars.push(`--glow-${k}:${v}`);
  vars.push(`--ease:${motion.ease}`);
  return `:root{${vars.join(";")}}`;
}
