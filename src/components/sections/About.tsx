import { entreprise, presentation } from "@/content/site";
import { Vinyl } from "@/components/fx/Vinyl";
import { FadeIn, MaskText } from "@/components/ui/Reveal";
import { Fill } from "@/components/ui/Fill";
import { PhotoSlot } from "@/components/ui/PhotoSlot";

export function About() {
  return (
    <section id="presentation" aria-labelledby="presentation-titre" className="relative section-pad overflow-hidden">
            <div className="container-stage grid items-center gap-16 lg:grid-cols-[1.1fr_1fr] lg:gap-24">
        <div>
          <FadeIn>
            <p className="eyebrow mb-5 flex items-center gap-2.5">
              <span className="size-1.5 rounded-full bg-gold" aria-hidden />
              {presentation.surTitre}
            </p>
          </FadeIn>
          <MaskText
            id="presentation-titre"
            text={presentation.titre}
            className="font-display text-[clamp(2rem,4.6vw,3.75rem)] font-semibold leading-[1.05] tracking-[-0.035em] text-balance"
          />
          <div className="mt-8 max-w-xl space-y-5 text-lg leading-relaxed text-ink-muted text-pretty">
            {presentation.paragraphes.map((p, i) => (
              <FadeIn key={i} delay={0.08 * i}>
                <p><Fill text={p} /></p>
              </FadeIn>
            ))}
          </div>

          <ol className="mt-14 grid gap-8 sm:grid-cols-3">
            {presentation.methode.map((m, i) => (
              <FadeIn key={m.titre} delay={0.1 * i}>
                <li className="h-full border-t border-line pt-5">
                  <span className="font-serif text-lg italic text-gold">0{i + 1}</span>
                  <h3 className="mt-2 font-display text-base font-semibold leading-snug tracking-[-0.01em]">{m.titre}</h3>
                  <p className="mt-2 text-sm text-ink-muted">{m.texte}</p>
                </li>
              </FadeIn>
            ))}
          </ol>
        </div>

        <div className="relative mx-auto w-full max-w-md lg:max-w-none">
          <FadeIn>
            <div className="relative aspect-[4/5] overflow-hidden rounded-xl">
              <PhotoSlot photo={presentation.photo} />
            </div>
          </FadeIn>
          <div className="absolute -bottom-10 -left-8 w-[58%] sm:-left-16 lg:-left-24">
            <Vinyl />
          </div>
          <p className="absolute -top-3 right-4 rounded-full bg-night-950 px-4 py-1.5 text-xs text-ink-muted ring-1 ring-line">
            {entreprise.adresse.ville} · {entreprise.adresse.departement}
          </p>
        </div>
      </div>
    </section>
  );
}
