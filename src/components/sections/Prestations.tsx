"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Link from "next/link";
import { prestations } from "@/content/site";
import type { CouleurAmbiance } from "@/content/types";
import { SectionHeading } from "@/components/ui/Reveal";
import { PhotoSlot } from "@/components/ui/PhotoSlot";

gsap.registerPlugin(ScrollTrigger);

const ambiance: Record<CouleurAmbiance, { rgb: string; text: string; ring: string }> = {
  gold: { rgb: "var(--rgb-gold)", text: "text-gold", ring: "shadow-glow-gold" },
  magenta: { rgb: "var(--rgb-magenta)", text: "text-magenta-soft", ring: "shadow-glow-magenta" },
  cyan: { rgb: "var(--rgb-cyan)", text: "text-cyan", ring: "shadow-glow-cyan" },
  violet: { rgb: "var(--rgb-violet)", text: "text-violet", ring: "shadow-glow-magenta" },
};

export function Prestations() {
  const section = useRef<HTMLElement>(null);
  const pin = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mm = gsap.matchMedia();
    mm.add("(min-width: 1024px) and (prefers-reduced-motion: no-preference)", () => {
      const t = track.current!;
      const distance = () => t.scrollWidth - window.innerWidth;
      const tween = gsap.to(t, {
        x: () => -distance(),
        ease: "none",
        scrollTrigger: {
          trigger: pin.current,
          start: "top top",
          end: () => `+=${distance()}`,
          pin: true,
          scrub: 0.8,
          invalidateOnRefresh: true,
          anticipatePin: 1,
          onUpdate: (self) => {
            if (bar.current) bar.current.style.transform = `scaleX(${self.progress})`;
          },
        },
      });
      // Chaque carte s'allume en entrant dans le cadre
      gsap.utils.toArray<HTMLElement>("[data-presta]").forEach((card) => {
        gsap.fromTo(
          card.querySelector("[data-light]"),
          { opacity: 0.25 },
          {
            opacity: 1,
            ease: "none",
            scrollTrigger: {
              trigger: card,
              containerAnimation: tween,
              start: "left 85%",
              end: "left 30%",
              scrub: true,
            },
          },
        );
      });
    });
    return () => mm.revert();
  }, []);

  return (
    <section ref={section} id="prestations" aria-labelledby="prestations-titre" className="relative">
      <div className="container-stage pt-[var(--s-section)] pb-12 lg:motion-safe:pb-0">
        <SectionHeading titleId="prestations-titre" eyebrow={prestations.surTitre} title={prestations.titre} intro={prestations.intro} />
      </div>

      <div ref={pin} className="relative lg:motion-safe:flex lg:motion-safe:h-screen lg:motion-safe:items-center lg:motion-safe:overflow-hidden">
        <div
          ref={track}
          className="container-stage flex flex-col gap-6 pb-[var(--s-section)] lg:motion-safe:w-max lg:motion-safe:max-w-none lg:motion-safe:flex-row lg:motion-safe:gap-8 lg:motion-safe:pb-0 lg:motion-safe:pl-[max(var(--s-gutter),calc((100vw-var(--s-max))/2+var(--s-gutter)))] lg:motion-safe:pr-[20vw] will-change-transform"
        >
          {prestations.liste.map((p, i) => {
            const a = ambiance[p.couleur];
            return (
              <article
                key={p.id}
                id={`prestation-${p.id}`}
                data-presta
                className="group relative isolate overflow-hidden rounded-xl border border-line bg-night-900 lg:motion-safe:h-[72vh] lg:motion-safe:w-[min(78vw,64rem)] lg:motion-safe:shrink-0"
              >
                {/* Lumière d'ambiance propre à la carte */}
                <div
                  data-light
                  aria-hidden
                  className="absolute inset-0 -z-10"
                  style={{
                    background: `radial-gradient(80% 70% at 85% 10%, rgb(${a.rgb} / .35), transparent 60%), radial-gradient(60% 50% at 0% 100%, rgb(${a.rgb} / .18), transparent 70%)`,
                  }}
                />
                <div aria-hidden className="absolute -top-1/2 right-[18%] -z-10 h-[160%] w-40 rotate-[18deg] opacity-40 blur-2xl transition-opacity duration-700 group-hover:opacity-70" style={{ background: `linear-gradient(to bottom, rgb(${a.rgb} / .55), transparent 75%)` }} />

                <div className="grid h-full gap-0 lg:grid-cols-[1.05fr_1fr]">
                  <div className="flex flex-col justify-between gap-8 p-7 sm:p-10 lg:p-14">
                    <div>
                      <span className={`font-display text-sm ${a.text}`}>0{i + 1} / 0{prestations.liste.length}</span>
                      <h3 className="mt-4 font-display text-[clamp(2rem,4.4vw,3.75rem)] font-semibold leading-[0.98] tracking-[-0.02em]">
                        {p.titre}
                      </h3>
                      <p className={`mt-4 font-display text-lg font-light italic ${a.text}`}>{p.accroche}</p>
                      <p className="mt-5 max-w-md text-ink-muted text-pretty">{p.texte}</p>
                    </div>
                    <div>
                      <ul className="flex flex-wrap gap-2">
                        {p.points.map((pt) => (
                          <li key={pt} className="rounded-full border border-line bg-white/[0.03] px-3.5 py-1.5 text-sm text-ink/85">
                            {pt}
                          </li>
                        ))}
                      </ul>
                      <Link
                        href="/#devis"
                        className={`mt-8 inline-flex items-center gap-2 font-display text-xs uppercase tracking-[0.18em] ${a.text} hover:underline underline-offset-8`}
                      >
                        Demander un devis {p.titre.toLowerCase()} →
                      </Link>
                    </div>
                  </div>
                  <div className="relative m-3 mt-0 aspect-[4/3] overflow-hidden rounded-lg lg:m-4 lg:ml-0 lg:motion-safe:aspect-auto">
                    <PhotoSlot photo={p.photo} />
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <div aria-hidden className="absolute inset-x-0 bottom-8 hidden lg:motion-safe:block">
          <div className="container-stage">
            <div className="h-px w-full overflow-hidden bg-line">
              <div ref={bar} className="h-full origin-left scale-x-0 bg-gradient-to-r from-gold via-magenta to-cyan" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
