import { entreprise, presentation } from "@/content/site";
import { Vinyl } from "@/components/fx/Vinyl";
import { FadeIn, MaskText } from "@/components/ui/Reveal";
import { Fill } from "@/components/ui/Fill";
import { PhotoSlot } from "@/components/ui/PhotoSlot";

export function About() {
  return (
    <section id="presentation" aria-labelledby="presentation-titre" className="relative section-pad overflow-hidden">
      <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(50%_60%_at_85%_30%,rgb(var(--rgb-magenta)/.12),transparent),radial-gradient(40%_50%_at_0%_80%,rgb(var(--rgb-gold)/.08),transparent)]" />
      <div className="container-stage grid items-center gap-16 lg:grid-cols-[1.1fr_1fr] lg:gap-24">
        <div>
          <FadeIn>
            <p className="eyebrow mb-5 flex items-center gap-3">
              <span className="h-px w-8 bg-gold/60" aria-hidden />
              {presentation.surTitre}
            </p>
          </FadeIn>
          <MaskText
            id="presentation-titre"
            text={presentation.titre}
            className="font-display text-[clamp(2rem,5.2vw,4.25rem)] font-semibold leading-[1.02] tracking-[-0.02em] text-balance"
          />
          <div className="mt-8 space-y-5 text-lg text-ink-muted text-pretty">
            {presentation.paragraphes.map((p, i) => (
              <FadeIn key={i} delay={0.08 * i}>
                <p><Fill text={p} /></p>
              </FadeIn>
            ))}
          </div>

          <ol className="mt-12 grid gap-4 sm:grid-cols-3">
            {presentation.methode.map((m, i) => (
              <FadeIn key={m.titre} delay={0.1 * i}>
                <li className="glass h-full rounded-lg p-5">
                  <span className="font-display text-sm text-gold">0{i + 1}</span>
                  <h3 className="mt-3 font-display text-base font-semibold leading-snug">{m.titre}</h3>
                  <p className="mt-2 text-sm text-ink-muted">{m.texte}</p>
                </li>
              </FadeIn>
            ))}
          </ol>
        </div>

        <div className="relative mx-auto w-full max-w-md lg:max-w-none">
          <FadeIn>
            <div className="relative aspect-[4/5] overflow-hidden rounded-xl border border-line">
              <PhotoSlot photo={presentation.photo} />
            </div>
          </FadeIn>
          <div className="absolute -bottom-10 -left-8 w-[58%] sm:-left-16 lg:-left-24">
            <Vinyl />
          </div>
          <p className="absolute -top-4 right-4 rounded-full border border-gold/30 bg-night-950/80 px-4 py-2 text-xs uppercase tracking-[0.2em] text-gold backdrop-blur">
            {entreprise.adresse.ville} · {entreprise.adresse.departement}
          </p>
        </div>
      </div>
    </section>
  );
}
