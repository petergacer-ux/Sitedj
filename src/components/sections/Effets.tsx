"use client";

import { useEffect, useRef, useState } from "react";
import { effets } from "@/content/site";
import type { EffetCarte } from "@/content/types";
import { SectionHeading, FadeIn } from "@/components/ui/Reveal";
import { EffectCanvas } from "@/components/fx/EffectCanvas";
import { useReducedMotion } from "@/lib/hooks";
import type { LightName } from "@/styles/tokens";

const AMBIANCES: LightName[] = ["gold", "magenta", "cyan", "violet"];

const icons: Record<EffetCarte["effet"], React.ReactNode> = {
  fumee: <path d="M4 16c2-2 4 2 6 0s4 2 6 0 4 2 4 2M4 12c2-2 4 2 6 0s4 2 6 0 4 2 4 2M7 8c1.5-1.5 3 1.5 4.5 0S14.5 9.5 16 8" />,
  etincelles: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" />,
  eclairage: <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z" />,
  ondes: <path d="M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3" />,
  notes: <path d="M9 18V6l10-2v12M9 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM19 16a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z" />,
  projecteur: <path d="M3 7h12v10H3zM15 10l6-3v10l-6-3" />,
};

function EffetCard({
  carte,
  reduced,
  onLight,
  index,
}: {
  carte: EffetCarte;
  reduced: boolean;
  onLight: (on: boolean) => void;
  index: number;
}) {
  const [emitting, setEmitting] = useState(false);
  const [running, setRunning] = useState(false);
  const linger = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pointer = useRef("mouse");

  const set = (on: boolean) => {
    setEmitting(on);
    if (carte.effet === "eclairage") onLight(on);
    clearTimeout(linger.current);
    if (on) setRunning(true);
    else linger.current = setTimeout(() => setRunning(false), 3500);
  };
  useEffect(() => () => clearTimeout(linger.current), []);

  const big = carte.effet === "fumee" || carte.effet === "etincelles";

  return (
    <FadeIn delay={(index % 3) * 0.08} className={big ? "md:col-span-1 lg:row-span-2" : ""}>
      <article
        onPointerEnter={(e) => e.pointerType === "mouse" && set(true)}
        onPointerLeave={(e) => e.pointerType === "mouse" && set(false)}
        onPointerDown={(e) => (pointer.current = e.pointerType)}
        onClick={() => {
          // tap sur mobile / tablette (à la souris, c'est le survol qui déclenche)
          if (pointer.current !== "mouse") set(!emitting);
        }}
        data-on={emitting ? 1 : 0}
        data-cursor
        className={`group relative isolate flex h-full cursor-pointer flex-col justify-end overflow-hidden rounded-lg border border-line bg-night-900/80 p-6 transition-[border-color,box-shadow,transform] duration-500 ease-stage data-[on=1]:-translate-y-1 data-[on=1]:border-gold/40 data-[on=1]:shadow-glow-gold sm:p-7 ${
          big ? "min-h-[300px] lg:min-h-[100%]" : "min-h-[230px]"
        }`}
      >
        <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(90%_60%_at_50%_0%,rgb(var(--rgb-gold)/.08),transparent)] opacity-0 transition-opacity duration-500 group-data-[on=1]:opacity-100" />
        <div className="absolute inset-0 -z-10">
          <EffectCanvas effet={carte.effet} emitting={emitting} running={running} reduced={reduced} />
        </div>

        <span className="mb-auto grid size-12 place-items-center rounded-full border border-gold/30 bg-night-950/50 text-gold backdrop-blur transition-colors group-data-[on=1]:bg-gold group-data-[on=1]:text-night-950">
          <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            {icons[carte.effet]}
          </svg>
        </span>
        <h3 className={`mt-10 font-display [text-shadow:0_2px_12px_rgb(0_0_0/.6)] font-semibold leading-tight ${big ? "text-2xl sm:text-3xl" : "text-xl"}`}>{carte.titre}</h3>
        <p className="mt-2 max-w-sm text-sm text-ink-muted text-pretty">{carte.texte}</p>
        <button
          type="button"
          aria-pressed={emitting}
          onClick={(e) => {
            e.stopPropagation();
            set(!emitting);
          }}
          className="mt-4 self-start rounded-full border border-line px-3 py-1 text-[0.65rem] uppercase tracking-[0.2em] text-ink-faint transition-colors hover:text-gold focus-visible:text-gold"
        >
          {emitting ? "Arrêter l'aperçu" : "Voir l'effet"}
        </button>
      </article>
    </FadeIn>
  );
}

export function Effets() {
  const reduced = useReducedMotion();
  const [light, setLight] = useState(false);
  const [amb, setAmb] = useState(0);

  useEffect(() => {
    if (!light) return;
    setAmb((a) => (a + 1) % AMBIANCES.length);
    if (reduced) return;
    const id = setInterval(() => setAmb((a) => (a + 1) % AMBIANCES.length), 1300);
    return () => clearInterval(id);
  }, [light, reduced]);

  return (
    <section id="effets" aria-labelledby="effets-titre" className="relative isolate section-pad overflow-hidden">
      {/* Lumière ambiante pilotée par la carte « Éclairage » */}
      <div aria-hidden className="absolute inset-0 -z-10">
        {AMBIANCES.map((c, i) => (
          <div
            key={c}
            className="absolute inset-0 transition-opacity duration-[1200ms]"
            style={{
              opacity: (light ? (i === amb ? 1 : 0) : i === 0 ? 0.45 : 0),
              background: `radial-gradient(60% 50% at 50% 0%, rgb(var(--rgb-${c}) / .28), transparent 70%), radial-gradient(40% 40% at 100% 100%, rgb(var(--rgb-${c}) / .18), transparent 70%)`,
            }}
          />
        ))}
      </div>

      <div className="container-stage">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <SectionHeading titleId="effets-titre" eyebrow={effets.surTitre} title={effets.titre} intro={effets.intro} />
          <p className="hidden shrink-0 items-center gap-2 text-xs uppercase tracking-[0.25em] text-ink-faint md:flex">
            <span className="size-2 animate-pulse rounded-full bg-magenta" /> {effets.indication}
          </p>
        </div>

        <div className="mt-14 grid auto-rows-[minmax(230px,auto)] gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {effets.liste.map((c, i) => (
            <EffetCard key={c.id} carte={c} index={i} reduced={reduced} onLight={setLight} />
          ))}
        </div>
      </div>
    </section>
  );
}
