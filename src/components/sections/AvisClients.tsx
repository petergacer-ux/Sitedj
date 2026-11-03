import { avis } from "@/content/site";
import { SectionHeading, FadeIn } from "@/components/ui/Reveal";

/** Section masquée tant qu'aucun VRAI avis n'est ajouté dans site.ts. */
export function AvisClients() {
  if (!avis.liste.length) return null;
  return (
    <section id="avis" aria-labelledby="avis-titre" className="relative section-pad">
      <div className="container-stage">
        <SectionHeading titleId="avis-titre" eyebrow={avis.surTitre} title={avis.titre} />
        <ul className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {avis.liste.map((a, i) => (
            <FadeIn key={i} delay={(i % 3) * 0.08}>
              <li className="glass flex h-full flex-col rounded-lg p-7">
                {a.note ? (
                  <p className="text-gold" aria-label={`Note : ${a.note} sur 5`}>
                    {"★".repeat(Math.round(a.note))}
                    <span className="text-ink-faint">{"★".repeat(5 - Math.round(a.note))}</span>
                  </p>
                ) : null}
                <blockquote className="mt-4 flex-1 text-lg leading-relaxed text-ink/90">« {a.texte} »</blockquote>
                <footer className="mt-6 text-sm">
                  <span className="font-display font-semibold text-ink">{a.nom}</span>
                  <span className="text-ink-faint">
                    {" · "}
                    {a.evenement}
                    {a.date ? ` · ${a.date}` : ""}
                    {a.source ? ` · via ${a.source}` : ""}
                  </span>
                </footer>
              </li>
            </FadeIn>
          ))}
        </ul>
      </div>
    </section>
  );
}
