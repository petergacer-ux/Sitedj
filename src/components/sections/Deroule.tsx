"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { deroule } from "@/content/site";
import { SectionHeading } from "@/components/ui/Reveal";
import { Equalizer } from "@/components/fx/Equalizer";

gsap.registerPlugin(ScrollTrigger);

/**
 * Timeline « Le déroulé de votre soirée » :
 * la ligne se dessine au scroll, chaque étape s'allume, et la lumière
 * de la section monte jusqu'à « la piste de danse ».
 */
export function Deroule() {
  const section = useRef<HTMLElement>(null);
  const list = useRef<HTMLOListElement>(null);
  const line = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const s = section.current!;
    const mm = gsap.matchMedia();
    mm.add(
      { motion: "(prefers-reduced-motion: no-preference)", reduce: "(prefers-reduced-motion: reduce)" },
      (ctx) => {
        const steps = gsap.utils.toArray<HTMLElement>("[data-step]", s);
        if (ctx.conditions?.reduce) {
          s.style.setProperty("--lux", "1");
          steps.forEach((el) => (el.dataset.on = "1"));
          if (line.current) line.current.style.transform = "scaleY(1)";
          return;
        }
        gsap.fromTo(
          line.current,
          { scaleY: 0 },
          {
            scaleY: 1,
            ease: "none",
            scrollTrigger: {
              trigger: list.current,
              start: "top 60%",
              end: "bottom 60%",
              scrub: 0.6,
              onUpdate: (self) => s.style.setProperty("--lux", self.progress.toFixed(3)),
            },
          },
        );
        steps.forEach((el) => {
          ScrollTrigger.create({
            trigger: el,
            start: "top 62%",
            onEnter: () => (el.dataset.on = "1"),
            onLeaveBack: () => (el.dataset.on = "0"),
          });
        });
      },
    );
    return () => mm.revert();
  }, []);

  const last = deroule.etapes.length - 1;

  return (
    <section
      ref={section}
      id="deroule"
      aria-labelledby="deroule-titre"
      className="relative isolate overflow-clip section-pad"
      style={{ ["--lux" as string]: 0 }}
    >
      {/* Lumière qui monte au fil de la soirée */}
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="sticky top-0 h-screen w-full overflow-hidden">
          <div className="absolute inset-0 bg-night-950" />
          <div
            className="absolute inset-0 transition-opacity duration-300"
            style={{
              opacity: "calc(var(--lux) * 1)",
              background:
                "radial-gradient(70% 60% at 50% 110%, rgb(var(--rgb-magenta) / .35), transparent 70%), radial-gradient(50% 50% at 15% 0%, rgb(var(--rgb-gold) / .22), transparent 70%), radial-gradient(50% 50% at 90% 10%, rgb(var(--rgb-cyan) / .14), transparent 70%)",
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              opacity: "calc((var(--lux) - .75) * 4)",
              background:
                "conic-gradient(from 200deg at 20% -10%, transparent 0 8deg, rgb(var(--rgb-gold) / .25) 12deg, transparent 18deg 60deg, rgb(var(--rgb-magenta) / .22) 66deg, transparent 72deg), conic-gradient(from 130deg at 80% -10%, transparent 0 10deg, rgb(var(--rgb-cyan) / .18) 15deg, transparent 21deg 50deg, rgb(var(--rgb-gold) / .2) 55deg, transparent 62deg)",
            }}
          />
        </div>
      </div>

      <div className="container-stage">
        <SectionHeading titleId="deroule-titre" eyebrow={deroule.surTitre} title={deroule.titre} intro={deroule.intro} align="center" />

        {/* Variateur de lumière */}
        <div aria-hidden className="mx-auto mt-10 flex max-w-xs items-center gap-3 text-[0.65rem] uppercase tracking-[0.25em] text-ink-faint">
          <span>Lumière</span>
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-line">
            <div className="h-full origin-left rounded-full bg-gradient-to-r from-gold to-magenta" style={{ transform: "scaleX(var(--lux))" }} />
          </div>
        </div>

        <ol ref={list} className="relative mx-auto mt-20 max-w-5xl">
          {/* Rail */}
          <div aria-hidden className="absolute bottom-0 left-[19px] top-0 w-px bg-line md:left-1/2 md:-translate-x-1/2" />
          <div
            ref={line}
            aria-hidden
            className="absolute bottom-0 left-[18px] top-0 w-[3px] origin-top scale-y-0 rounded-full bg-gradient-to-b from-gold via-magenta to-gold-soft shadow-[0_0_16px_rgb(var(--rgb-gold)/.7)] md:left-1/2 md:-translate-x-1/2"
          />

          {deroule.etapes.map((e, i) => {
            const right = i % 2 === 1;
            const final = i === last;
            return (
              <li
                key={e.titre}
                data-step
                data-on="0"
                className={`group relative grid pb-16 pl-14 last:pb-0 md:grid-cols-2 md:gap-16 md:pl-0 ${final ? "md:pb-0" : ""}`}
              >
                {/* Nœud */}
                <span
                  aria-hidden
                  className="absolute left-[8px] top-1 grid size-6 place-items-center rounded-full border border-line bg-night-900 transition-all duration-500 group-data-[on=1]:border-gold group-data-[on=1]:bg-gold group-data-[on=1]:shadow-glow-gold md:left-1/2 md:-translate-x-1/2"
                >
                  <span className="size-1.5 rounded-full bg-ink-faint transition-colors group-data-[on=1]:bg-night-950" />
                  {final && <span className="absolute inset-0 rounded-full border border-magenta opacity-0 group-data-[on=1]:animate-[pulse-ring_1.6s_ease-out_infinite]" />}
                </span>

                <div
                  className={`transition-all duration-700 ease-stage opacity-35 translate-y-3 group-data-[on=1]:translate-y-0 group-data-[on=1]:opacity-100 ${
                    right ? "md:col-start-2" : "md:text-right"
                  }`}
                >
                  <span className="font-display text-xs uppercase tracking-[0.3em] text-gold">Acte {String(i + 1).padStart(2, "0")}</span>
                  <h3
                    className={`mt-2 font-display font-semibold tracking-[-0.01em] transition-[color,text-shadow] duration-700 ${
                      final
                        ? "text-[clamp(2rem,5vw,3.5rem)] leading-none group-data-[on=1]:text-gradient"
                        : "text-2xl sm:text-3xl group-data-[on=1]:text-ink text-ink-muted"
                    }`}
                  >
                    {e.titre}
                  </h3>
                  <p className={`mt-3 text-ink-muted text-pretty ${right ? "" : "md:ml-auto"} max-w-md`}>{e.texte}</p>
                </div>

                {final && (
                  <div aria-hidden className="col-span-full mt-10 h-24 opacity-0 transition-opacity duration-1000 group-data-[on=1]:opacity-100 md:mt-14">
                    <Equalizer bars={36} />
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
